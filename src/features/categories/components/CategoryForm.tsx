"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
  t,
}: {
  locale: (typeof NON_DEFAULT_LOCALES)[number];
  form: ReturnType<typeof useForm<CategoryInput>>;
  fallbackName: string;
  fallbackDescription: string;
  excludeId?: string;
  t: ReturnType<typeof useTranslations<"categories">>;
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
            <FormLabel>{t("name")}</FormLabel>
            <FormControl>
              <Input
                placeholder={fallbackName || withEgPrefix(uiLocale, CATEGORY_EXAMPLES.name[locale])}
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
                  placeholder={withEgPrefix(uiLocale, CATEGORY_EXAMPLES.slug[locale])}
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
                entity="category"
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
                rows={2}
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

export function CategoryForm(props: CategoryFormProps) {
  const t = useTranslations("adminCategories");
  const onInvalid = useInvalidToast();
  const locale = useLocale();
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

  const pathname = usePathname();

  const form = useForm<CategoryInput>({
    // Validate on blur, then on change, so the message tracks the current value.
    mode: "onTouched",
    resolver: useZodResolver(categorySchema),
    defaultValues: derivedValues,
    // In edit mode, re-sync the form when the underlying category changes
    // (e.g., user navigates away from the edit page and returns - Next.js can
    // preserve the React tree, so without this the unsaved edits would persist).
    values: props.mode === "edit" ? derivedValues : undefined,
  });

  // Create mode has no server `values` to re-sync against; reset to empty on
  // entry so a half-filled form doesn't survive leave-and-return.
  useEffect(() => {
    if (props.mode === "create") form.reset(derivedValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const nameValue = useWatch({ control: form.control, name: "name" });
  const descriptionValue = useWatch({ control: form.control, name: "description" });
  const parentId = useWatch({ control: form.control, name: "parentId" });

  // Auto-generate slug from name when not manually edited
  const prevNameRef = useRef(form.getValues("name"));
  useEffect(() => {
    if (slugManuallyEdited) return;
    if (nameValue === prevNameRef.current) return;
    prevNameRef.current = nameValue;
    form.setValue("slug", slugify(nameValue ?? ""), { shouldDirty: false });
  }, [nameValue, slugManuallyEdited, form]);

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
                <FormLabel>{t("name")}</FormLabel>
                <FormControl>
                  <Input placeholder={withEgPrefix(locale, CATEGORY_EXAMPLES.name[DEFAULT_LOCALE])} {...field} />
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
                    rows={2}
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
            excludeId={props.mode === "edit" ? props.categoryId : undefined}
            t={t}
          />
        ))}

        {/* Slug */}
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
                  entity="category"
                  locale={DEFAULT_LOCALE}
                  slug={field.value}
                  excludeId={props.mode === "edit" ? props.categoryId : undefined}
                />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

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
                <Input
                  type="number"
                  min={0}
                  className="w-32"
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === "" ? 0 : e.target.valueAsNumber,
                    )
                  }
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormDescription>{t("orderDesc")}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* isActive */}
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
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
            </FormItem>
          )}
        />

        {/* isFeatured - only for root departments */}
        {isRoot && (
          <FormField
            control={form.control}
            name="isFeatured"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border p-4 border-amber-500/30 bg-amber-500/5">
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