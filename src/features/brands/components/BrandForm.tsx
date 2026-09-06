"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandLogo, type LogoBackdrop } from "./BrandLogo";
import { detectLogoBackdropClient } from "../utils/detectBackdropClient";
import { createBrandSchema, updateBrandSchema, CreateBrandInput, UpdateBrandInput } from "../schema/brands";
import { createBrandAction, updateBrandAction } from "../actions/brands";
import { slugify } from "@/lib/utils";
import { deriveOrRestore } from "@/lib/forms/deriveOrRestore";
import { useIsFormDirty } from "@/lib/forms/useIsFormDirty";
import { NON_DEFAULT_LOCALES, LOCALE_LABELS, DEFAULT_LOCALE } from "@/i18n/config";
import { BRAND_EXAMPLES, withEgPrefix } from "@/i18n/form-examples";
import { SlugAvailabilityIndicator } from "@/components/admin/SlugAvailabilityIndicator";

function emptyBrandTranslations(): NonNullable<CreateBrandInput["translations"]> {
  const out: Record<string, { name?: string; slug?: string; description?: string }> = {};
  for (const loc of NON_DEFAULT_LOCALES) {
    out[loc] = { name: "", slug: "", description: "" };
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
  fallbackDescription,
  excludeId,
  autoResolvesSlug,
  t,
}: {
  locale: (typeof NON_DEFAULT_LOCALES)[number];
  form: ReturnType<typeof useForm<CreateBrandInput>>;
  fallbackName: string;
  fallbackDescription: string;
  excludeId?: string;
  /** Create mode: the server suffixes a colliding slug instead of failing. */
  autoResolvesSlug: boolean;
  t: ReturnType<typeof useTranslations<"brands">>;
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
            <FormLabel>{t("brandName")}</FormLabel>
            <FormControl>
              <Input
                placeholder={fallbackName || withEgPrefix(uiLocale, BRAND_EXAMPLES.name[locale])}
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
                  placeholder={withEgPrefix(uiLocale, BRAND_EXAMPLES.slug[locale])}
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
                entity="brand"
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
                rows={3}
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
 * One theme's logo preview. For a manual backdrop it renders immediately. For
 * AUTO it runs the same detection the server will (client-side via canvas) so
 * the preview matches the saved result; when detection can't run (e.g. the
 * image host blocks CORS) it shows a "computed on save" placeholder instead of
 * a misleading tile.
 */
function LogoThemePreview({
  src,
  selected,
  name,
  label,
  themeClass,
}: {
  src: string | null;
  selected: LogoBackdrop;
  name: string;
  label: string;
  themeClass: "light" | "dark";
}) {
  const t = useTranslations("brands");
  const isAuto = selected === "AUTO";
  const [detected, setDetected] = useState<{
    status: "idle" | "loading" | "done" | "failed";
    backdrop: LogoBackdrop | null;
  }>({ status: "idle", backdrop: null });

  useEffect(() => {
    if (!isAuto || !src) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetected({ status: "idle", backdrop: null });
      return;
    }
    let cancelled = false;
    setDetected({ status: "loading", backdrop: null });
    detectLogoBackdropClient(src).then((bd) => {
      if (cancelled) return;
      setDetected(bd ? { status: "done", backdrop: bd } : { status: "failed", backdrop: null });
    });
    return () => {
      cancelled = true;
    };
  }, [src, isAuto]);

  const resolved: LogoBackdrop | null = isAuto ? detected.backdrop : selected;
  // AUTO with an image we couldn't analyze yet -> avoid a false tile.
  const showPlaceholder = isAuto && Boolean(src) && resolved == null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={themeClass}>
        {showPlaceholder ? (
          <div
            className="flex h-11 w-11 items-center justify-center rounded-sm border border-dashed border-border bg-muted text-muted-foreground"
            title={t("logoBackdropAutoPending")}
          >
            {detected.status === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </div>
        ) : (
          <BrandLogo src={src} backdrop={resolved ?? "AUTO"} name={name} size={44} />
        )}
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

type CreateMode = {
  mode: "create";
  defaultValues?: Partial<CreateBrandInput>;
};

type EditMode = {
  mode: "edit";
  brandId: string;
  defaultValues: UpdateBrandInput;
};

type BrandFormProps = CreateMode | EditMode;

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
export function BrandForm(props: BrandFormProps) {
  const [discardKey, setDiscardKey] = useState(0);
  return (
    <BrandFormInner
      key={discardKey}
      {...props}
      onDiscard={() => setDiscardKey((k) => k + 1)}
    />
  );
}

function BrandFormInner(props: BrandFormProps & { onDiscard: () => void }) {
  const t = useTranslations("brands");
  const onInvalid = useInvalidToast();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const derivedValues = useMemo<CreateBrandInput>(
    () => ({
      name: "",
      slug: "",
      logoUrl: "",
      logoUrlDark: "",
      logoBackdrop: "AUTO",
      logoBackdropDark: "AUTO",
      description: "",
      translations: emptyBrandTranslations(),
      ...props.defaultValues,
    }),
    [props.defaultValues],
  );

  const navGeneration = useNavigationGeneration();

  const form = useForm<CreateBrandInput>({
    // Validate on every change so errors surface immediately and `hasErrors`
    // can gate the save button (consistent across all admin forms).
    mode: "onChange",
    resolver: useZodResolver(props.mode === "create" ? createBrandSchema : updateBrandSchema),
    defaultValues: derivedValues,
    // In edit mode, re-sync the form when the underlying brand changes
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
  const { defaultValues: savedValues } = useFormState({ control: form.control });

  // NOT react-hook-form's `isDirty`: that flag is only recomputed inside the
  // write that triggered it, so the auto-derived slug (written in a follow-up
  // step) is never accounted for and the flag stays stuck on.
  const isDirty = useIsFormDirty(form.control);

  // Create mode has no server-supplied `values` to re-sync against, so a
  // half-filled form would otherwise survive when the user leaves and returns
  // (Next.js keeps the route's React tree warm). Reset to empty on entry. Keyed
  // on the navigation-generation counter, which bumps on every path change -
  // including returning to the same route (`usePathname` stays identical there
  // and so never fired the reset).
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
  const logoUrlValue = useWatch({ control: form.control, name: "logoUrl" });
  const logoUrlDarkValue = useWatch({ control: form.control, name: "logoUrlDark" });
  const logoBackdropValue = useWatch({ control: form.control, name: "logoBackdrop" });
  const logoBackdropDarkValue = useWatch({ control: form.control, name: "logoBackdropDark" });

  // The preview can't run the server-side image analysis, so for AUTO it shows
  // the default light tile. The real backdrop is computed from each image on
  // save. Mirror BrandLogo's per-theme asset/backdrop pick so we can show each
  // theme's result as its own preview (a single theme-following preview would
  // only ever reveal one of the two assets at a time).
  const previewBackdrop = (logoBackdropValue as LogoBackdrop | undefined) ?? "AUTO";
  const previewBackdropDark = (logoBackdropDarkValue as LogoBackdrop | undefined) ?? "AUTO";
  const pvLightSrc = logoUrlValue || logoUrlDarkValue || null;
  const pvDarkSrc = logoUrlDarkValue || logoUrlValue || null;
  const pvLightBackdrop = logoUrlValue ? previewBackdrop : previewBackdropDark;
  const pvDarkBackdrop = logoUrlDarkValue ? previewBackdropDark : previewBackdrop;

  // A backdrop is meaningless without its asset, so each select is disabled when
  // its URL is empty. Keep the value on AUTO in that case so a disabled select
  // never sits on a stale value the user can't change (and a leftover manual
  // choice isn't persisted).
  useEffect(() => {
    if (!logoUrlValue && form.getValues("logoBackdrop") !== "AUTO") {
      form.setValue("logoBackdrop", "AUTO");
    }
  }, [logoUrlValue, form]);
  useEffect(() => {
    if (!logoUrlDarkValue && form.getValues("logoBackdropDark") !== "AUTO") {
      form.setValue("logoBackdropDark", "AUTO");
    }
  }, [logoUrlDarkValue, form]);

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
  // valid brand isn't disabled before the first validation runs).
  // `Object.keys(errors)` reads the WHOLE error object, whose identity never
  // changes (react-hook-form mutates it in place), so under the React Compiler
  // it memoizes to its first result and the flag freezes at `false`. Reading it
  // through the hook keeps it live. See useSaveBlockedReason for the details.
  const hasErrors = useHasFormErrors(form.control);

  const saveBlockedReason = useSaveBlockedReason(form.control);

  const onSubmit = (data: CreateBrandInput | UpdateBrandInput) => {
    startTransition(async () => {
      const result =
        props.mode === "edit"
          ? await updateBrandAction(props.brandId, data)
          : await createBrandAction(data);

      if (result && "error" in result) {
        toast.error(result.message);
      }
    });
  };

  const backdropFmt = (v: unknown) =>
    v === "LIGHT"
      ? t("logoBackdropLight")
      : v === "DARK"
        ? t("logoBackdropDark")
        : v === "NEUTRAL"
          ? t("logoBackdropNeutral")
          : t("logoBackdropAuto");

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
                <FormLabel required>{t("brandName")}</FormLabel>
                <FormControl>
                  <Input placeholder={withEgPrefix(locale, BRAND_EXAMPLES.name[DEFAULT_LOCALE])} {...field} />
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
                      placeholder={withEgPrefix(locale, BRAND_EXAMPLES.slug[DEFAULT_LOCALE])}
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
                    entity="brand"
                    locale={DEFAULT_LOCALE}
                    slug={field.value}
                    excludeId={props.mode === "edit" ? props.brandId : undefined}
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
                    rows={3}
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
            excludeId={props.mode === "edit" ? props.brandId : undefined}
            autoResolvesSlug={props.mode !== "edit"}
            t={t}
          />
        ))}

        {/* ── Logo & backdrop ── */}
        <div className="rounded-lg border border-border/60 p-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("logoSection")}
            </p>
            {/* Always show one preview per theme so each logo's own backdrop is
                visible at once. The theme class wraps only the logo (forcing the
                real light/dark context regardless of the editor's theme); labels
                stay outside so they read against the page. */}
            <div className="flex items-start gap-3">
              <LogoThemePreview
                src={pvLightSrc}
                selected={pvLightBackdrop}
                name={nameValue || "?"}
                label={t("logoPreviewLight")}
                themeClass="light"
              />
              <LogoThemePreview
                src={pvDarkSrc}
                selected={pvDarkBackdrop}
                name={nameValue || "?"}
                label={t("logoPreviewDark")}
                themeClass="dark"
              />
            </div>
          </div>

          <FormField
            control={form.control}
            name="logoUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("logoUrl")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("logoPlaceholder")} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>{t("logoDesc")}</FormDescription>
                <FieldChangedHint />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="logoBackdrop"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("logoBackdrop")}</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={logoUrlValue ? (field.value ?? "AUTO") : "AUTO"}
                  disabled={!logoUrlValue}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="AUTO">{t("logoBackdropAuto")}</SelectItem>
                    <SelectItem value="LIGHT">{t("logoBackdropLight")}</SelectItem>
                    <SelectItem value="DARK">{t("logoBackdropDark")}</SelectItem>
                    <SelectItem value="NEUTRAL">{t("logoBackdropNeutral")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>{t("logoBackdropDesc")}</FormDescription>
                <FieldChangedHint format={backdropFmt} />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="logoUrlDark"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("logoUrlDark")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("logoPlaceholder")} {...field} value={field.value ?? ""} />
                </FormControl>
                <FormDescription>{t("logoUrlDarkDesc")}</FormDescription>
                <FieldChangedHint />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="logoBackdropDark"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("logoBackdropForDark")}</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={logoUrlDarkValue ? (field.value ?? "AUTO") : "AUTO"}
                  disabled={!logoUrlDarkValue}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="AUTO">{t("logoBackdropAuto")}</SelectItem>
                    <SelectItem value="LIGHT">{t("logoBackdropLight")}</SelectItem>
                    <SelectItem value="DARK">{t("logoBackdropDark")}</SelectItem>
                    <SelectItem value="NEUTRAL">{t("logoBackdropNeutral")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>{t("logoBackdropForDarkDesc")}</FormDescription>
                <FieldChangedHint format={backdropFmt} />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

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