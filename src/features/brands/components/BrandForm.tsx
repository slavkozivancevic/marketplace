"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, RefreshCw } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { toast } from "@/components/ui/sonner";
import { useInvalidToast } from "@/lib/forms/useInvalidToast";
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
    form.setValue(slugPath, slugify(nameValue ?? ""), { shouldDirty: false });
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
            <FormMessage />
          </FormItem>
        )}
      />
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

export function BrandForm(props: BrandFormProps) {
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
      description: "",
      translations: emptyBrandTranslations(),
      ...props.defaultValues,
    }),
    [props.defaultValues],
  );

  const pathname = usePathname();

  const form = useForm<CreateBrandInput>({
    // Validate on blur, then keep validating on change, so the error message
    // tracks the current value instead of lagging a keystroke behind.
    mode: "onTouched",
    resolver: useZodResolver(props.mode === "create" ? createBrandSchema : updateBrandSchema),
    defaultValues: derivedValues,
    // In edit mode, re-sync the form when the underlying brand changes
    // (e.g., user navigates away from the edit page and returns - Next.js can
    // preserve the React tree, so without this the unsaved edits would persist).
    values: props.mode === "edit" ? derivedValues : undefined,
  });

  // Create mode has no server-supplied `values` to re-sync against, so a
  // half-filled form would otherwise survive when the user leaves and returns
  // (Next.js keeps the route's React tree warm). Reset to empty on entry.
  useEffect(() => {
    if (props.mode === "create") form.reset(derivedValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const nameValue = useWatch({ control: form.control, name: "name" });
  const descriptionValue = useWatch({ control: form.control, name: "description" });

  // Auto-generate slug from name when not manually edited
  const prevNameRef = useRef(form.getValues("name"));
  useEffect(() => {
    if (slugManuallyEdited) return;
    if (nameValue === prevNameRef.current) return;
    prevNameRef.current = nameValue;
    form.setValue("slug", slugify(nameValue ?? ""), { shouldDirty: false });
  }, [nameValue, slugManuallyEdited, form]);

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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6 max-w-2xl">
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
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="logoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("logoUrl")}</FormLabel>
              <FormControl>
                <Input placeholder={t("logoPlaceholder")} {...field} />
              </FormControl>
              <FormDescription>{t("logoDesc")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isPending} className="min-w-32">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {props.mode === "edit" ? t("saving") : t("creating")}
            </>
          ) : props.mode === "edit" ? (
            t("saveChanges")
          ) : (
            t("create")
          )}
        </Button>
      </form>
    </Form>
  );
}