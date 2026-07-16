"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useNavigationGeneration } from "@/lib/navigation/navGeneration";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import { FormSaveBar } from "@/components/forms/FormSaveBar";
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
  t,
}: {
  locale: (typeof NON_DEFAULT_LOCALES)[number];
  form: ReturnType<typeof useForm<CreateBrandInput>>;
  fallbackName: string;
  fallbackDescription: string;
  excludeId?: string;
  t: ReturnType<typeof useTranslations<"brands">>;
}) {
  const uiLocale = useLocale();
  const namePath = `translations.${locale}.name` as const;
  const slugPath = `translations.${locale}.slug` as const;
  const descriptionPath = `translations.${locale}.description` as const;

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
                entity="brand"
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
 * Discard wrapper. With RHF's `values` prop in play, `form.reset()` can leave
 * `isDirty` spuriously true after the reset (the value re-sync re-flags the form
 * dirty with an empty `dirtyFields`), so the save bar never clears. Instead of
 * fighting that, "Discard" remounts the form via a bumped key: a fresh mount
 * re-reads the saved baseline and is reliably clean.
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
  });

  // Create mode has no server-supplied `values` to re-sync against, so a
  // half-filled form would otherwise survive when the user leaves and returns
  // (Next.js keeps the route's React tree warm). Reset to empty on entry. Keyed
  // on the navigation-generation counter, which bumps on every path change -
  // including returning to the same route (`usePathname` stays identical there
  // and so never fired the reset).
  useEffect(() => {
    if (props.mode === "create") form.reset(derivedValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navGeneration]);

  const nameValue = useWatch({ control: form.control, name: "name" });
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
    form.setValue("slug", slugify(nameValue ?? ""), { shouldDirty: true });
  }, [nameValue, slugManuallyEdited, form]);

  useUnsavedChangesWarning(props.mode === "edit" && form.formState.isDirty);

  // Block saving while any field is invalid (error-based, so a freshly-loaded
  // valid brand isn't disabled before the first validation runs).
  const hasErrors = Object.keys(form.formState.errors).length > 0;

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
                <FormLabel>{t("brandName")}</FormLabel>
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
                    entity="brand"
                    locale={DEFAULT_LOCALE}
                    slug={field.value}
                    excludeId={props.mode === "edit" ? props.brandId : undefined}
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