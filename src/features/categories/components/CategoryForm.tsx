"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCw } from "lucide-react";
import { useForm, useFormState, useWatch } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import { useBoolFormat } from "@/lib/forms/changedFormatters";
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
import { NumberStepper } from "@/components/ui/number-stepper";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categorySchema, type CategoryInput } from "../schema/categories";
import { createCategoryAction, updateCategoryAction } from "../actions/categories";
import { slugify } from "@/lib/utils";
import { deriveOrRestore } from "@/lib/forms/deriveOrRestore";
import { useIsFormDirty } from "@/lib/forms/useIsFormDirty";
import { getCategoryName } from "../utils/translations";
import { useLocale } from "next-intl";
import { NON_DEFAULT_LOCALES, LOCALE_LABELS, DEFAULT_LOCALE } from "@/i18n/config";
import { CATEGORY_EXAMPLES, withEgPrefix } from "@/i18n/form-examples";
import { SlugAvailabilityIndicator } from "@/components/admin/SlugAvailabilityIndicator";
import { CategoryAttributesField } from "./CategoryAttributesField";
import type { AttributeLibraryItem } from "@/features/attributes/db/attributes";

function emptyCategoryTranslations(): NonNullable<CategoryInput["translations"]> {
  const out: Record<string, { name?: string; slug?: string; description?: string }> = {};
  for (const loc of NON_DEFAULT_LOCALES) {
    out[loc] = { name: "", slug: "", description: "" };
  }
  return out;
}

/**
 * Per-locale fields card for CategoryForm. Mirrors the canonical-locale
 * Name+Slug+Description trio, with the same auto-slugify-from-name UX.
 * Lifted out of the parent component so each locale gets its own
 * manual-edit ref state without it leaking across languages.
 */
function PerLocaleSection({
  locale,
  form,
  fallbackName,
  fallbackDescription,
  excludeId,
  autoResolvesSlug,
  t,
}: {
  locale: (typeof NON_DEFAULT_LOCALES)[number];
  form: ReturnType<typeof useForm<CategoryInput>>;
  fallbackName: string;
  fallbackDescription: string;
  excludeId?: string;
  /** Create mode: the server suffixes a colliding slug instead of failing. */
  autoResolvesSlug: boolean;
  t: ReturnType<typeof useTranslations<"categories">>;
}) {
  const uiLocale = useLocale();
  const namePath = `translations.${locale}.name` as const;
  const slugPath = `translations.${locale}.slug` as const;
  const descriptionPath = `translations.${locale}.description` as const;

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
            <FormLabel>{t("name")}</FormLabel>
            <FormControl>
              <Input
                placeholder={fallbackName || withEgPrefix(uiLocale, CATEGORY_EXAMPLES.name[locale])}
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
                  placeholder={withEgPrefix(uiLocale, CATEGORY_EXAMPLES.slug[locale])}
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
                entity="category"
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

      <FormField
        control={form.control}
        name={descriptionPath}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("description")}</FormLabel>
            <FormControl>
              <Textarea
                placeholder={fallbackDescription || t("descPlaceholder")}
                rows={2}
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FieldChangedHint />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

/**
 * Parent picker option shape. Carries the full per-locale translation rows
 * so the dropdown label resolves to the active UI language - no need for
 * the caller to pre-compute a name string.
 */
type ParentOption = {
  id: string;
  parentId: string | null;
  translations: {
    locale: string;
    name: string;
    slug: string;
    description: string | null;
  }[];
};

type CreateMode = { mode: "create"; defaultValues?: Partial<CategoryInput> };
type EditMode = {
  mode: "edit";
  categoryId: string;
  defaultValues: CategoryInput;
};
type CategoryFormProps = (CreateMode | EditMode) & {
  /** All existing categories for the parent selector (excluding this category itself in edit mode). */
  parentOptions: ParentOption[];
  /** Global attribute library for the assignment picker. */
  attributeLibrary: AttributeLibraryItem[];
  /** categoryId -> directly-assigned attribute ids, for inheritance display. */
  categoryAttributeMap: Record<string, string[]>;
};

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
export function CategoryForm(props: CategoryFormProps) {
  const [discardKey, setDiscardKey] = useState(0);
  return (
    <CategoryFormInner
      key={discardKey}
      {...props}
      onDiscard={() => setDiscardKey((k) => k + 1)}
    />
  );
}

function CategoryFormInner(props: CategoryFormProps & { onDiscard: () => void }) {
  const t = useTranslations("adminCategories");
  const onInvalid = useInvalidToast();
  const locale = useLocale();
  const boolFmt = useBoolFormat();
  const [isPending, startTransition] = useTransition();
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const derivedValues = useMemo<CategoryInput>(
    () => ({
      name: "",
      slug: "",
      parentId: null,
      imageUrl: "",
      description: "",
      translations: emptyCategoryTranslations(),
      order: 0,
      isActive: true,
      isFeatured: false,
      attributes: [],
      ...props.defaultValues,
    }),
    [props.defaultValues],
  );

  const navGeneration = useNavigationGeneration();

  const form = useForm<CategoryInput>({
    // Validate on every change so errors surface immediately and `hasErrors`
    // can gate the save button (consistent across all admin forms).
    mode: "onChange",
    resolver: useZodResolver(categorySchema),
    defaultValues: derivedValues,
    // In edit mode, re-sync the form when the underlying category changes
    // (e.g., user navigates away from the edit page and returns - Next.js can
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
  // caches whatever `form.formState.x` returned on the first read, leaving
  // isDirty/errors stuck stale after the very first render. `useFormState`
  // is a real hook call - the compiler tracks it correctly - and is the
  // react-hook-form-documented way to read formState reactively (see the
  // identical fix in VariantsEditor.tsx).
  const { errors, defaultValues: savedValues } = useFormState({ control: form.control });

  // NOT react-hook-form's `isDirty`: that flag is only recomputed inside the
  // write that triggered it, so the auto-derived slug (written in a follow-up
  // step) is never accounted for and the flag stays stuck on.
  const isDirty = useIsFormDirty(form.control);

  // Create mode has no server `values` to re-sync against; reset to empty on
  // entry so a half-filled form doesn't survive leave-and-return. Keyed on the
  // navigation-generation counter, which bumps on every path change - including
  // returning to the same route (`usePathname` stays identical there and so
  // never fired the reset).
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
  const descriptionValue = useWatch({ control: form.control, name: "description" });
  const parentId = useWatch({ control: form.control, name: "parentId" });

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

  useUnsavedChangesWarning(props.mode === "edit" && isDirty);

  // Block saving while any field is invalid (error-based, so a freshly-loaded
  // valid category isn't disabled before the first validation runs).
  const hasErrors = Object.keys(errors).length > 0;

  const onSubmit = (data: CategoryInput) => {
    startTransition(async () => {
      const result =
        props.mode === "edit"
          ? await updateCategoryAction(props.categoryId, data)
          : await createCategoryAction(data);

      if (result && "error" in result) {
        toast.error(result.message);
      }
    });
  };

  // Only root categories (parentId = null) can be featured departments
  const isRoot = !parentId;

  // Departments = parentOptions with no parentId themselves
  const departments = props.parentOptions.filter((o) => o.parentId === null);
  const subCategories = props.parentOptions.filter((o) => o.parentId !== null);

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
                <FormLabel required>{t("name")}</FormLabel>
                <FormControl>
                  <Input placeholder={withEgPrefix(locale, CATEGORY_EXAMPLES.name[DEFAULT_LOCALE])} {...field} />
                </FormControl>
                <FieldChangedHint />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Slug lives inside the locale box, mirroring the per-locale
              sections (name -> slug -> description). */}
          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("slug")}</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      placeholder={withEgPrefix(locale, CATEGORY_EXAMPLES.slug[DEFAULT_LOCALE])}
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
                    entity="category"
                    locale={DEFAULT_LOCALE}
                    slug={field.value}
                    excludeId={props.mode === "edit" ? props.categoryId : undefined}
                    autoResolves={props.mode !== "edit"}
                  />
                </div>
                <FieldChangedHint />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("description")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t("descPlaceholder")}
                    rows={2}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
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
            fallbackDescription={descriptionValue ?? ""}
            excludeId={props.mode === "edit" ? props.categoryId : undefined}
            autoResolvesSlug={props.mode !== "edit"}
            t={t}
          />
        ))}

        {/* Parent */}
        <FormField
          control={form.control}
          name="parentId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("parent")}</FormLabel>
              <Select
                value={field.value ?? "none"}
                onValueChange={(v) => field.onChange(v === "none" ? null : v)}
              >
                <FormControl>
                  <SelectTrigger>
                    {/* Explicit label so it shows pre-hydration (Radix's
                        SelectContent is portaled and the value→item lookup
                        isn't available yet). */}
                    <SelectValue placeholder={t("parentPlaceholder")}>
                      {field.value
                        ? (() => {
                            const opt = props.parentOptions.find(
                              (o) => o.id === field.value,
                            );
                            return opt ? getCategoryName(opt, locale) : t("noParent");
                          })()
                        : t("noParent")}
                    </SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent position="popper" className="max-h-72">
                  <SelectItem value="none">{t("noParent")}</SelectItem>
                  {departments.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                        {t("departments")}
                      </div>
                      {departments.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {getCategoryName(opt, locale)}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {subCategories.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                        {t("subcategories")}
                      </div>
                      {subCategories.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {getCategoryName(opt, locale)}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <FormDescription>{t("parentDesc")}</FormDescription>
              <FieldChangedHint
                format={(v) => {
                  const opt = props.parentOptions.find((o) => o.id === v);
                  return opt ? getCategoryName(opt, locale) : t("noParent");
                }}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Image URL */}
        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("imageUrl")}</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://..."
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>{t("imageUrlDesc")}</FormDescription>
              <FieldChangedHint />
              <FormMessage />
            </FormItem>
          )}
        />


        {/* Order */}
        <FormField
          control={form.control}
          name="order"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("order")}</FormLabel>
              <FormControl>
                <NumberStepper
                  min={0}
                  className="w-32"
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? 0)}
                />
              </FormControl>
              <FormDescription>{t("orderDesc")}</FormDescription>
              <FieldChangedHint />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* isActive */}
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <FormLabel className="text-base">{t("isActive")}</FormLabel>
                  <FormDescription>{t("isActiveDesc")}</FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </div>
              <FieldChangedHint format={boolFmt} />
            </FormItem>
          )}
        />

        {/* isFeatured - only for root departments */}
        {isRoot && (
          <FormField
            control={form.control}
            name="isFeatured"
            render={({ field }) => (
              <FormItem className="rounded-lg border p-4 border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center justify-between">
                  <div>
                    <FormLabel className="text-base">{t("isFeatured")}</FormLabel>
                    <FormDescription>{t("isFeaturedDesc")}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </div>
                <FieldChangedHint format={boolFmt} />
              </FormItem>
            )}
          />
        )}

        {/* Attribute filters assigned to this category */}
        <CategoryAttributesField
          form={form}
          attributeLibrary={props.attributeLibrary}
          categoryAttributeMap={props.categoryAttributeMap}
          parentOptions={props.parentOptions}
        />

        {props.mode === "edit" ? (
          <FormSaveBar
            isDirty={isDirty}
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