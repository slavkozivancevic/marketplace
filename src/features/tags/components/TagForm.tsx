"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, RefreshCw } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import { FormSaveBar } from "@/components/forms/FormSaveBar";
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
  t,
}: {
  locale: (typeof NON_DEFAULT_LOCALES)[number];
  form: ReturnType<typeof useForm<CreateTagInput>>;
  fallbackName: string;
  excludeId?: string;
  t: ReturnType<typeof useTranslations<"tags">>;
}) {
  const uiLocale = useLocale();
  const namePath = `translations.${locale}.name` as const;
  const slugPath = `translations.${locale}.slug` as const;

  const nameValue = useWatch({ control: form.control, name: namePath });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const prevNameRef = useRef<string | undefined>(form.getValues(namePath));

  useEffect(() => {
    if (slugManuallyEdited) return;
    if (nameValue === prevNameRef.current) return;
    prevNameRef.current = nameValue;
    form.setValue(slugPath, slugify(nameValue ?? ""), { shouldDirty: true });
  }, [nameValue, slugManuallyEdited, form, slugPath]);

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
                    setSlugManuallyEdited(true);
                  }}
                />
              </FormControl>
              {slugManuallyEdited && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    form.setValue(slugPath, slugify(form.getValues(namePath) ?? ""));
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
 * Discard wrapper. With RHF's `values` prop in play, `form.reset()` can leave
 * `isDirty` spuriously true after the reset (the value re-sync re-flags the
 * form dirty with an empty `dirtyFields`), so the save bar never clears.
 * Instead of fighting that, "Discard" remounts the form via a bumped key: a
 * fresh mount re-reads the saved baseline and is reliably clean.
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
  });

  // Create mode has no server-supplied `values` to re-sync against, so a
  // half-filled form would otherwise survive when the user leaves and returns
  // (Next.js keeps the route's React tree warm). Reset to empty on entry,
  // keyed on the navigation-generation counter (bumps on every path change,
  // including returning to the same route where usePathname stays identical).
  useEffect(() => {
    if (props.mode === "create") form.reset(derivedValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navGeneration]);

  const nameValue = useWatch({ control: form.control, name: "name" });

  // Auto-generate slug from name when not manually edited
  const prevNameRef = useRef(form.getValues("name"));
  useEffect(() => {
    if (slugManuallyEdited) return;
    if (nameValue === prevNameRef.current) return;
    prevNameRef.current = nameValue;
    form.setValue("slug", slugify(nameValue ?? ""), { shouldDirty: true });
  }, [nameValue, slugManuallyEdited, form]);

  useUnsavedChangesWarning(props.mode === "edit" && form.formState.isDirty);

  // Block saving while any field is invalid (error-based, so a freshly-loaded
  // valid tag isn't disabled before the first validation runs).
  const hasErrors = Object.keys(form.formState.errors).length > 0;

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
                        setSlugManuallyEdited(true);
                      }}
                    />
                  </FormControl>
                  {slugManuallyEdited && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        form.setValue("slug", slugify(form.getValues("name") ?? ""));
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
            t={t}
          />
        ))}

        {props.mode === "edit" ? (
          <FormSaveBar
            isDirty={form.formState.isDirty}
            isPending={isPending}
            onDiscard={props.onDiscard}
            saveLabel={t("saveChanges")}
            saveDisabled={hasErrors}
          />
        ) : (
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
        )}
      </form>
      </ChangedHintScope>
    </Form>
  );
}
