"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, RefreshCw } from "lucide-react";
import { useForm, useFormState, useWatch } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import {
  useHasFormErrors,
  useSaveBlockedReason,
} from "@/lib/forms/useSaveBlockedReason";
import { FormSaveBar } from "@/components/forms/FormSaveBar";
import { SaveBlockedNotice } from "@/components/forms/SaveBlockedNotice";
import { RequiredFieldsNote } from "@/components/forms/RequiredFieldsNote";
import { FieldChangedHint, ChangedHintScope } from "@/components/forms/FieldChangedHint";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTagSchema, updateTagSchema, CreateTagInput, UpdateTagInput } from "../schema/tags";
import { createTagAction, updateTagAction } from "../actions/tags";
import { slugify } from "@/lib/utils";
import { deriveOrRestore } from "@/lib/forms/deriveOrRestore";
import { useIsFormDirty } from "@/lib/forms/useIsFormDirty";
import { NON_DEFAULT_LOCALES, LOCALE_LABELS, DEFAULT_LOCALE } from "@/i18n/config";
import { TAG_EXAMPLES, withEgPrefix } from "@/i18n/form-examples";
import { SlugAvailabilityIndicator } from "@/components/admin/SlugAvailabilityIndicator";

function emptyTagTranslations(): NonNullable<CreateTagInput["translations"]> {
  const out: Record<string, { name?: string; slug?: string }> = {};
  for (const loc of NON_DEFAULT_LOCALES) {
    out[loc] = { name: "", slug: "" };
  }
  return out;
}

/**
 * Per-locale fields card. Auto-slugifies the translated name into the
 * locale's slug whenever the slug input hasn't been manually edited - same
 * UX as the canonical-locale section above. Lifted out of the parent
 * component so each locale gets its own `useRef`/`useState` instance
 * without leaking the manual-edit flag between languages.
 */
function PerLocaleSection({
  locale,
  form,
  fallbackName,
  excludeId,
  autoResolvesSlug,
  t,
}: {
  locale: (typeof NON_DEFAULT_LOCALES)[number];
  form: ReturnType<typeof useForm<CreateTagInput>>;
  fallbackName: string;
  excludeId?: string;
  /** Create mode: the server suffixes a colliding slug instead of failing. */
  autoResolvesSlug: boolean;
  t: ReturnType<typeof useTranslations<"tags">>;
}) {
  const uiLocale = useLocale();
  const namePath = `translations.${locale}.name` as const;
  const slugPath = `translations.${locale}.slug` as const;

  const nameValue = useWatch({ control: form.control, name: namePath });
  const slugValue = useWatch({ control: form.control, name: slugPath });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const prevNameRef = useRef<string | undefined>(form.getValues(namePath));
  // `useFormState` (not `form.formState.defaultValues` directly) - the React
  // Compiler treats `form` as a stable dependency and can cache a stale
  // snapshot of the proxy read otherwise (see the identical fix in
  // VariantsEditor.tsx).
  const { defaultValues: savedFormValues } = useFormState({ control: form.control });

  useEffect(() => {
    if (slugManuallyEdited) return;
    if (nameValue === prevNameRef.current) return;
    prevNameRef.current = nameValue;
    const saved = savedFormValues?.translations?.[locale];
    form.setValue(
      slugPath,
      deriveOrRestore(nameValue, saved?.name, saved?.slug, slugify),
      { shouldDirty: true },
    );
    // `savedFormValues` is deliberately NOT a dependency: it's read as the
    // saved baseline, and re-running this on a baseline re-sync would rewrite
    // the slug without the user having touched the name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameValue, slugManuallyEdited, form, slugPath, locale]);

  // What auto-generation would produce right now. Must be `deriveOrRestore`,
  // NOT a bare `slugify`: while the name still matches what was saved, the auto
  // value IS the saved slug (suffix and all). Using `slugify` here made the
  // button hand back an un-suffixed slug the saved record already owns -
  // regenerating walked straight into "already in use".
  const autoSlug = deriveOrRestore(
    nameValue,
    savedFormValues?.translations?.[locale]?.name,
    savedFormValues?.translations?.[locale]?.slug,
    slugify,
  );
  const canRegenerateSlug = slugManuallyEdited && (slugValue ?? "") !== autoSlug;

  return (
    <div className="rounded-lg border border-border/60 p-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {LOCALE_LABELS[locale].emoji} {LOCALE_LABELS[locale].label}
      </p>

      <FormField
        control={form.control}
        name={namePath}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("tagName")}</FormLabel>
            <FormControl>
              <Input
                placeholder={fallbackName || withEgPrefix(uiLocale, TAG_EXAMPLES.name[locale])}
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FieldChangedHint />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={slugPath}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("slug")}</FormLabel>
            <div className="flex gap-2">
              <FormControl>
                <Input
                  placeholder={withEgPrefix(uiLocale, TAG_EXAMPLES.slug[locale])}
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    field.onChange(e);
                    // An emptied field means "I have no manual value" - hand the
                    // slug back to auto-generation instead of latching the
                    // manual flag on forever.
                    setSlugManuallyEdited(e.target.value.trim() !== "");
                  }}
                />
              </FormControl>
              {canRegenerateSlug && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    form.setValue(slugPath, autoSlug, { shouldDirty: true });
                    setSlugManuallyEdited(false);
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
            <div className="flex items-center justify-between">
              <FormDescription>{t("slugDesc")}</FormDescription>
              <SlugAvailabilityIndicator
                entity="tag"
                locale={locale}
                slug={field.value}
                excludeId={excludeId}
                autoResolves={autoResolvesSlug}
              />
            </div>
            <FieldChangedHint />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

type CreateMode = {
  mode: "create";
  defaultValues?: Partial<CreateTagInput>;
};

type EditMode = {
  mode: "edit";
  tagId: string;
  defaultValues: UpdateTagInput;
};

type TagFormProps = CreateMode | EditMode;

/**
 * Discard wrapper. Remounting via a bumped key - rather than calling
 * `form.reset()` - is what makes "Discard" actually restore everything:
 * meaningful state lives OUTSIDE react-hook-form and `reset()` never touches
 * it. `slugManuallyEdited` exists once here and once per locale section, so a
 * plain reset would restore the values yet leave every slug still flagged as
 * hand-edited: auto-generation stays off and the regenerate button keeps
 * hanging around after a discard. A fresh mount re-reads the saved baseline
 * and is reliably clean in one step.
 *
 * (This also predates `useIsFormDirty`, which fixed the separate problem of a
 * stuck save bar - but the local-state reason above is why remounting stays.)
 */
export function TagForm(props: TagFormProps) {
  const [discardKey, setDiscardKey] = useState(0);
  return (
    <TagFormInner
      key={discardKey}
      {...props}
      onDiscard={() => setDiscardKey((k) => k + 1)}
    />
  );
}

function TagFormInner(props: TagFormProps & { onDiscard: () => void }) {
  const t = useTranslations("tags");
  const onInvalid = useInvalidToast();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const derivedValues = useMemo<CreateTagInput>(
    () => ({
      name: "",
      slug: "",
      translations: emptyTagTranslations(),
      ...props.defaultValues,
    }),
    [props.defaultValues],
  );

  const navGeneration = useNavigationGeneration();

  const form = useForm<CreateTagInput>({
    mode: "onChange",
    resolver: useZodResolver(props.mode === "create" ? createTagSchema : updateTagSchema),
    defaultValues: derivedValues,
    // In edit mode, re-sync the form when the underlying tag changes (e.g.
    // the user navigates away from the edit page and returns - Next.js can
    // preserve the React tree, so without this the unsaved edits would persist).
    values: props.mode === "edit" ? derivedValues : undefined,
    // Without this, every re-render that produces a fresh `derivedValues`
    // object makes RHF fully reset the form and discard whatever is being
    // typed - intermittently, since it depends on what triggered the re-render.
    // `keepDirtyValues` re-syncs untouched fields from the server while leaving
    // edited ones alone (ProductForm has always done this).
    resetOptions: { keepDirtyValues: true },
  });

  // `form.formState.x` is a proxy getter - its value changes without the
  // `form` object's own reference ever changing, which the React Compiler's
  // memoization can't see: it treats `form` as a stable dependency and
  // caches whatever `form.formState.x` returned on the first read, so
  // isDirty/errors/defaultValues would go stale after the very first render
  // (e.g. typing into a field then deleting it back to empty left the
  // unsaved-changes bar stuck showing forever). `useFormState` is a real
  // hook call - the compiler tracks it correctly - and is the
  // react-hook-form-documented way to read formState reactively (see the
  // identical fix in VariantsEditor.tsx).
  const { defaultValues: savedValues } = useFormState({
    control: form.control,
  });

  // NOT react-hook-form's `isDirty`: that flag is only recomputed inside the
  // write that triggered it, so the auto-derived slug (written in a follow-up
  // step) is never accounted for and the flag stays stuck on.
  const isDirty = useIsFormDirty(form.control);

  // Create mode has no server-supplied `values` to re-sync against, so a
  // half-filled form would otherwise survive when the user leaves and returns
  // (Next.js keeps the route's React tree warm). Reset to empty on entry,
  // keyed on the navigation-generation counter (bumps on every path change,
  // including returning to the same route where usePathname stays identical).
  useEffect(() => {
    if (props.mode === "create")
      // Explicit `keepDirtyValues: false`: a bare `reset()` MERGES the
      // useForm-level `resetOptions`, which would keep the half-filled values
      // this reset exists to clear.
      form.reset(derivedValues, { keepDirtyValues: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navGeneration]);

  const nameValue = useWatch({ control: form.control, name: "name" });
  const slugValue = useWatch({ control: form.control, name: "slug" });

  // Auto-generate slug from name when not manually edited
  const prevNameRef = useRef(form.getValues("name"));
  useEffect(() => {
    if (slugManuallyEdited) return;
    if (nameValue === prevNameRef.current) return;
    prevNameRef.current = nameValue;
    const saved = savedValues;
    form.setValue(
      "slug",
      deriveOrRestore(nameValue, saved?.name, saved?.slug, slugify),
      { shouldDirty: true },
    );
    // Baseline read only - see the per-locale section for why it stays out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameValue, slugManuallyEdited, form]);

  // See the per-locale section: `deriveOrRestore`, not a bare `slugify`, so
  // regenerating while the name is unchanged restores the SAVED slug instead
  // of an un-suffixed one the record already owns.
  const autoSlug = deriveOrRestore(
    nameValue,
    savedValues?.name,
    savedValues?.slug,
    slugify,
  );
  const canRegenerateSlug = slugManuallyEdited && (slugValue ?? "") !== autoSlug;

  // Not gated on edit mode: a half-filled create form is exactly as easy to
  // lose to a stray nav click, and `isDirty` compares against the empty
  // defaults, so an untouched form still never prompts.
  useUnsavedChangesWarning(isDirty);

  // Block saving while any field is invalid (error-based, so a freshly-loaded
  // valid tag isn't disabled before the first validation runs).
  // `Object.keys(errors)` reads the WHOLE error object, whose identity never
  // changes (react-hook-form mutates it in place), so under the React Compiler
  // it memoizes to its first result and the flag freezes at `false`. Reading it
  // through the hook keeps it live. See useSaveBlockedReason for the details.
  const hasErrors = useHasFormErrors(form.control);

  const saveBlockedReason = useSaveBlockedReason(form.control);

  const onSubmit = (data: CreateTagInput | UpdateTagInput) => {
    startTransition(async () => {
      const result =
        props.mode === "edit"
          ? await updateTagAction(props.tagId, data)
          : await createTagAction(data);

      if (result && "error" in result) {
        toast.error(result.message);
      }
    });
  };

  return (
    <Form {...form}>
      <ChangedHintScope enabled={props.mode === "edit"}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6 max-w-2xl">
        <RequiredFieldsNote />
        {/* ── Default locale (canonical) ── */}
        <div className="rounded-lg border border-border/60 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {LOCALE_LABELS[DEFAULT_LOCALE].emoji} {LOCALE_LABELS[DEFAULT_LOCALE].label}
          </p>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel required>{t("tagName")}</FormLabel>
                <FormControl>
                  <Input placeholder={withEgPrefix(locale, TAG_EXAMPLES.name[DEFAULT_LOCALE])} {...field} />
                </FormControl>
                <FieldChangedHint />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Slug lives inside the locale box, mirroring the per-locale
              sections (name -> slug). */}
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("slug")}</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      placeholder={withEgPrefix(locale, TAG_EXAMPLES.slug[DEFAULT_LOCALE])}
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setSlugManuallyEdited(e.target.value.trim() !== "");
                      }}
                    />
                  </FormControl>
                  {canRegenerateSlug && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        form.setValue("slug", autoSlug, { shouldDirty: true });
                        setSlugManuallyEdited(false);
                      }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <FormDescription>{t("slugDesc")}</FormDescription>
                  <SlugAvailabilityIndicator
                    entity="tag"
                    locale={DEFAULT_LOCALE}
                    slug={field.value}
                    excludeId={props.mode === "edit" ? props.tagId : undefined}
                    autoResolves={props.mode !== "edit"}
                  />
                </div>
                <FieldChangedHint />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Translation sections - one per non-default locale ── */}
        {NON_DEFAULT_LOCALES.map((loc) => (
          <PerLocaleSection
            key={loc}
            locale={loc}
            form={form}
            fallbackName={nameValue ?? ""}
            excludeId={props.mode === "edit" ? props.tagId : undefined}
            autoResolvesSlug={props.mode !== "edit"}
            t={t}
          />
        ))}

        {props.mode === "edit" ? (
          <FormSaveBar
            isDirty={isDirty}
            isPending={isPending}
            onDiscard={props.onDiscard}
            saveLabel={t("saveChanges")}
            saveDisabled={hasErrors}
          saveDisabledReason={saveBlockedReason}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isPending || hasErrors} className="min-w-32">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("creating")}
                </>
              ) : (
                t("create")
              )}
            </Button>
            <SaveBlockedNotice blocked={hasErrors} reason={saveBlockedReason} />
          </div>
        )}
      </form>
      </ChangedHintScope>
    </Form>
  );
}
