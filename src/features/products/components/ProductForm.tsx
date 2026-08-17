"use client";
import axios from "axios";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useForm, useFormState, useWatch, Resolver, FieldErrors } from "react-hook-form";
import { useZodResolver } from "@/i18n/useZodResolver";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductMediaUpload } from "@/components/product/ProductMediaUpload";
import {
  createProductSchema,
  updateProductSchema,
  CreateProductInput,
  UpdateProductInput,
} from "../schema/products";
import { createProduct, updateProduct } from "../actions/products";
import {
  ProductTranslationsInput,
  SerializedProductWithRelations,
  PresignedUploadedMedia,
} from "@/types/types";
import { NON_DEFAULT_LOCALES, LOCALE_LABELS, DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/i18n/config";

type NonDefaultLocale = (typeof NON_DEFAULT_LOCALES)[number];
import { X, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import { slugify } from "@/lib/utils";
import { deriveOrRestore } from "@/lib/forms/deriveOrRestore";
import { buildOptionSelection } from "../utils/optionSelection";
import { useIsFormDirty } from "@/lib/forms/useIsFormDirty";
import { collectFormErrorMessages } from "@/lib/forms/formErrors";
import { BrandSelect, type BrandOption } from "@/features/brands/components/BrandSelect";
import { getBrandName } from "@/features/brands/utils/translations";
import { SlugAvailabilityIndicator } from "@/components/admin/SlugAvailabilityIndicator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { getCategoryName } from "@/features/categories/utils/translations";
import type { CategoryTreeItem } from "@/features/categories/db/categories";
import { getTagName } from "@/features/tags/utils/translations";
import type { TagListItem } from "@/features/tags/db/tags";
import { consumeLanguageSwitch, setPreserveAcrossLocaleSwitch } from "@/lib/i18n/localeSwitch";
import { useUnsavedChangesWarning } from "@/lib/forms/useUnsavedChangesWarning";
import { useBoolFormat } from "@/lib/forms/changedFormatters";
import { FormSaveBar } from "@/components/forms/FormSaveBar";
import { RequiredFieldsNote } from "@/components/forms/RequiredFieldsNote";
import { FieldChangedHint, ChangedHintScope } from "@/components/forms/FieldChangedHint";
import { ProductAttributesField } from "./ProductAttributesField";
import { VariantsEditor } from "./VariantsEditor";
import type { AttributeSelectorItem } from "@/features/attributes/db/attributes";
import { useCurrencyStore } from "@/store/currency";
import { PriceInput } from "./PriceInput";
import { formatPrice, convertCents, decimalToCents } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";

// ── Translation form shape ───────────────────────────────────────────────
//
// Form state always carries a slot for every non-default locale (even when
// empty), so RHF field paths like `translations.sr.title` are statically
// valid. The default locale lives in the canonical fields and is not
// represented here.

type ProductTranslationsLocaleFields = {
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  metaTitle: string;
  metaDescription: string;
};

type ProductTranslationsForm = Record<NonDefaultLocale, ProductTranslationsLocaleFields>;

const PRODUCT_TRANSLATION_FIELDS = [
  "title",
  "slug",
  "description",
  "shortDescription",
  "metaTitle",
  "metaDescription",
] as const;

function emptyProductLocaleFields(): ProductTranslationsLocaleFields {
  return {
    title: "",
    slug: "",
    description: "",
    shortDescription: "",
    metaTitle: "",
    metaDescription: "",
  };
}

function emptyProductTranslations(): ProductTranslationsForm {
  return Object.fromEntries(
    NON_DEFAULT_LOCALES.map((loc) => [loc, emptyProductLocaleFields()]),
  ) as ProductTranslationsForm;
}

/**
 * Builds the form's non-default-locale slots from the ProductTranslation row
 * array. Default-locale values are surfaced via the top-level `title` / `slug`
 * / `description` / … form fields, so the row for `DEFAULT_LOCALE` is skipped
 * here.
 */
function normalizeProductTranslations(
  rows: readonly {
    locale: string;
    title: string;
    slug: string;
    description: string;
    shortDescription: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
  }[] | null | undefined,
): ProductTranslationsForm {
  const result = emptyProductTranslations();
  if (!rows) return result;
  for (const loc of NON_DEFAULT_LOCALES) {
    const row = rows.find((r) => r.locale === loc);
    if (!row) continue;
    const slot = result[loc];
    slot.title = row.title ?? "";
    // A blank title still needs a real, unique stored slug (see
    // buildProductTranslationRows) purely to keep this locale's URL valid -
    // that's a derived implementation detail, not something the admin
    // entered, so the form shows it as blank too rather than as if it were.
    slot.slug = row.title ? (row.slug ?? "") : "";
    slot.description = row.description ?? "";
    slot.shortDescription = row.shortDescription ?? "";
    slot.metaTitle = row.metaTitle ?? "";
    slot.metaDescription = row.metaDescription ?? "";
  }
  return result;
}

function buildProductTranslationsPayload(
  form: ProductTranslationsForm,
): ProductTranslationsInput | null {
  const out: ProductTranslationsInput = {};
  let hasAny = false;
  for (const loc of NON_DEFAULT_LOCALES) {
    const slot = form[loc];
    const localeOut: NonNullable<ProductTranslationsInput[NonDefaultLocale]> = {};
    let localeHasAny = false;
    for (const field of PRODUCT_TRANSLATION_FIELDS) {
      const trimmed = slot[field].trim();
      if (trimmed) {
        localeOut[field] = trimmed;
        localeHasAny = true;
      }
    }
    if (localeHasAny) {
      out[loc] = localeOut;
      hasAny = true;
    }
  }
  return hasAny ? out : null;
}

/**
 * Always returns the full translation shape with each locale's `values` as a
 * record. Pre-initializing prevents RHF's `setValue` from creating an array
 * when a value key looks numeric (e.g. size "10").
 */
type ProductFormData = {
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  stock: number | null;
  barcode: string;
  taxable: boolean;
  taxCode: string;
  requiresShipping: boolean;
  isDigital: boolean;
  weight: number | null;
  weightUnit: "G" | "KG" | "LB" | "OZ" | null;
  length: number | null;
  width: number | null;
  height: number | null;
  dimensionUnit: "CM" | "IN" | null;
  metaTitle: string;
  metaDescription: string;
  translations: ProductTranslationsForm;
  brandId: string | undefined;
  categoryIds: string[];
  tagIds: string[];
  media: {
    key: string;
    mediaType: "IMAGE" | "VIDEO";
    thumbKey?: string | null;
    mimeType?: string | null;
    durationMs?: number | null;
    width?: number | null;
    height?: number | null;
  }[];
  // Variant axes (variant-defining attributes) - managed locally by the
  // VariantsEditor; not submitted directly (variants carry the values).
  options: { attributeId: string; optionIds: string[] }[];
  variants: {
    sku: string;
    price: number;
    compareAtPrice: number | null;
    costPrice: number | null;
    stock: number;
    barcode: string;
    weight: number | null;
    weightUnit: "G" | "KG" | "LB" | "OZ" | null;
    mediaKeys: string[];
    options: { attributeId: string; optionId: string }[];
  }[];
  attributes: {
    attributeId: string;
    optionIds: string[];
    valueNumeric: number | null;
    valueBool: boolean | null;
  }[];
  version: number;
};

export type { ProductFormData };

interface ProductFormProps {
  mode: "create" | "update";
  product?: SerializedProductWithRelations;
  brands?: BrandOption[];
  categoryTree?: CategoryTreeItem[];
  tags?: TagListItem[];
  attributeLibrary?: AttributeSelectorItem[];
  categoryAttributeMap?: Record<string, string[]>;
  onSuccess?: () => void;
  redirectTo?: string;
}

/** Collapses persisted attribute value rows into the form's grouped shape. */
function buildAttributeEntries(
  rows: { attributeId: string; optionId: string | null; valueNumeric: number | null; valueBool: boolean | null }[],
): ProductFormData["attributes"] {
  const byAttr = new Map<string, ProductFormData["attributes"][number]>();
  for (const r of rows) {
    let entry = byAttr.get(r.attributeId);
    if (!entry) {
      entry = { attributeId: r.attributeId, optionIds: [], valueNumeric: null, valueBool: null };
      byAttr.set(r.attributeId, entry);
    }
    if (r.optionId) entry.optionIds.push(r.optionId);
    else if (r.valueNumeric != null) entry.valueNumeric = r.valueNumeric;
    else if (r.valueBool != null) entry.valueBool = r.valueBool;
  }
  return [...byAttr.values()];
}

// ---------- CategoryPicker ----------

function CategoryPicker({
  tree,
  value,
  onChange,
}: {
  tree: CategoryTreeItem[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const locale = useLocale();
  const tForm = useTranslations("productForm");

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const allNodes = tree.flatMap((dept) => [dept, ...dept.children]);
  const selectedNames = value
    .map((id) => {
      const node = allNodes.find((n) => n.id === id);
      return node ? getCategoryName(node, locale) : null;
    })
    .filter(Boolean) as string[];

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-start font-normal text-left">
            {value.length === 0
              ? <span className="text-muted-foreground">{tForm("selectCategories")}</span>
              : <span className="truncate">{selectedNames.join(", ")}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0 max-h-72 overflow-y-auto">
          {tree.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{tForm("noCategories")}</p>
          ) : (
            <div className="p-2 space-y-3">
              {tree.map((dept) => (
                <div key={dept.id}>
                  <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer">
                    <Checkbox checked={value.includes(dept.id)} onCheckedChange={() => toggle(dept.id)} />
                    <span className="text-sm font-semibold">{getCategoryName(dept, locale)}</span>
                  </label>
                  {dept.children.length > 0 && (
                    <div className="ml-4 mt-0.5 space-y-0.5">
                      {dept.children.map((sub) => (
                        <label key={sub.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer">
                          <Checkbox checked={value.includes(sub.id)} onCheckedChange={() => toggle(sub.id)} />
                          <span className="text-sm text-muted-foreground">{getCategoryName(sub, locale)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const node = allNodes.find((n) => n.id === id);
            if (!node) return null;
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                {getCategoryName(node, locale)}
                <button type="button" onClick={() => toggle(id)} className="rounded-full hover:bg-muted-foreground/20 p-0.5 cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- TagPicker ----------

function TagPicker({
  options,
  value,
  onChange,
}: {
  options: TagListItem[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const locale = useLocale();
  const tForm = useTranslations("productForm");

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-start font-normal text-left">
            {value.length === 0
              ? <span className="text-muted-foreground">{tForm("selectTags")}</span>
              : <span className="truncate">{value.map((id) => getTagName(options.find((o) => o.id === id) ?? { translations: [] }, locale)).join(", ")}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0 max-h-72 overflow-y-auto">
          {options.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{tForm("noTags")}</p>
          ) : (
            <div className="p-2 space-y-0.5">
              {options.map((opt) => (
                <label key={opt.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer">
                  <Checkbox checked={value.includes(opt.id)} onCheckedChange={() => toggle(opt.id)} />
                  <span className="text-sm">{getTagName(opt, locale)}</span>
                </label>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((id) => {
            const opt = options.find((o) => o.id === id);
            if (!opt) return null;
            return (
              <Badge key={id} variant="secondary" className="gap-1 pr-1">
                {getTagName(opt, locale)}
                <button type="button" onClick={() => toggle(id)} className="rounded-full hover:bg-muted-foreground/20 p-0.5 cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

const WEIGHT_UNITS = [
  { value: "KG", label: "kg" },
  { value: "G", label: "g" },
  { value: "LB", label: "lb" },
  { value: "OZ", label: "oz" },
] as const;

const DIMENSION_UNITS = [
  { value: "CM", label: "cm" },
  { value: "IN", label: "in" },
] as const;

/**
 * Per-locale title + slug + short/full description card for the Translations
 * tab. Mirrors the canonical-locale UX:
 *   - slug auto-derives from the translated title while it hasn't been
 *     manually edited (own ref + own state per locale, so editing one
 *     language never leaks the "manually edited" flag into another),
 *   - a refresh button restores the auto-slugified value once the user
 *     has overridden it.
 *
 * Lifted out of the parent so each instance keeps its own state - putting
 * `useState` inside a `.map(...)` callback would violate the rules of
 * hooks across re-renders that change locale order.
 */
function PerLocaleProductSection({
  locale,
  form,
  fallbackTitle,
  fallbackShortDescription,
  fallbackDescription,
  excludeId,
  autoResolvesSlug,
  t,
}: {
  locale: (typeof NON_DEFAULT_LOCALES)[number];
  form: ReturnType<typeof useForm<ProductFormData, unknown, ProductFormData>>;
  fallbackTitle: string;
  fallbackShortDescription: string;
  fallbackDescription: string;
  excludeId?: string;
  /** Create mode: the server suffixes a colliding slug instead of failing. */
  autoResolvesSlug: boolean;
  t: ReturnType<typeof useTranslations<"productForm">>;
}) {
  const titlePath = `translations.${locale}.title` as const;
  const slugPath = `translations.${locale}.slug` as const;
  const shortDescPath = `translations.${locale}.shortDescription` as const;
  const descPath = `translations.${locale}.description` as const;

  const titleValue = useWatch({ control: form.control, name: titlePath });
  const slugValue = useWatch({ control: form.control, name: slugPath });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const prevTitleRef = useRef<string | undefined>(form.getValues(titlePath));
  // `useFormState` (not `form.formState.defaultValues` directly) - the React
  // Compiler treats `form` as a stable dependency and can cache a stale
  // snapshot of the proxy read otherwise (see the identical fix in
  // VariantsEditor.tsx). A plain proxy read here intermittently restored the
  // slug against a stale baseline, leaving it phantom-dirty.
  const { defaultValues: savedFormValues } = useFormState({ control: form.control });

  useEffect(() => {
    if (slugManuallyEdited) return;
    if (titleValue === prevTitleRef.current) return;
    prevTitleRef.current = titleValue;
    const saved = savedFormValues?.translations?.[locale];
    form.setValue(
      slugPath,
      deriveOrRestore(titleValue, saved?.title, saved?.slug, slugify),
      { shouldDirty: true },
    );
    // `savedFormValues` is deliberately NOT a dependency: it's read as the
    // saved baseline, and re-running this on a baseline re-sync would rewrite
    // the slug without the user having touched the title.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleValue, slugManuallyEdited, form, slugPath, locale]);

  // What auto-generation would produce right now. Must be `deriveOrRestore`,
  // NOT a bare `slugify`: while the title still matches what was saved, the
  // auto value IS the saved slug (suffix and all). Using `slugify` here made
  // the button hand back an un-suffixed slug that the saved record itself
  // already owns - regenerating walked straight into "already in use" - and
  // hid the button when the manual value differed from the saved slug but
  // happened to equal `slugify(title)`.
  const autoSlug = deriveOrRestore(
    titleValue,
    savedFormValues?.translations?.[locale]?.title,
    savedFormValues?.translations?.[locale]?.slug,
    slugify,
  );
  // The button only means something while the manual slug actually differs
  // from that; otherwise clicking it is a no-op that just makes it vanish.
  const canRegenerateSlug = slugManuallyEdited && (slugValue ?? "") !== autoSlug;

  return (
    <div className="rounded-md border border-border/60 p-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {LOCALE_LABELS[locale].emoji} {LOCALE_LABELS[locale].label}
        <span className="ml-1.5 font-normal text-muted-foreground normal-case tracking-normal">
          - {t("optional")}
        </span>
      </p>

      <FormField
        control={form.control}
        name={titlePath}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("titleField")}</FormLabel>
            <FormControl>
              <Input
                placeholder={fallbackTitle || t("titlePlaceholder")}
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
                  placeholder={t("slugPlaceholder")}
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
                entity="product"
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
        name={shortDescPath}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("shortDesc")}</FormLabel>
            <FormControl>
              <Input
                placeholder={fallbackShortDescription || t("shortDescPlaceholder")}
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
        name={descPath}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("description")}</FormLabel>
            <FormControl>
              <Textarea
                className="min-h-30"
                placeholder={fallbackDescription || t("descPlaceholder")}
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
 * Normalizes any media-like row into the EXACT shape RHF stores in the `media`
 * form field. Both the saved baseline (`derivedValues.media`) and the
 * uploadedMedia -> form sync MUST go through this. Otherwise null-vs-undefined
 * drift on the optional fields (the DB stores `null` for, e.g., an image's
 * `durationMs`/`thumbKey`, while `productToUploadedMedia` coalesces those to
 * `undefined`) makes RHF's deep dirty-check see value !== default and flag the
 * form as edited the instant it opens - the false "unsaved changes" + tab dot.
 */
function toFormMedia(m: {
  key: string;
  mediaType: "IMAGE" | "VIDEO";
  thumbKey?: string | null;
  mimeType?: string | null;
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
}): ProductFormData["media"][number] {
  return {
    key: m.key,
    mediaType: m.mediaType,
    thumbKey: m.thumbKey ?? null,
    mimeType: m.mimeType ?? null,
    durationMs: m.durationMs ?? null,
    width: m.width ?? null,
    height: m.height ?? null,
  };
}

/** Maps a product's server media into the upload component's shape. Shared by
 *  the initial state, the per-product re-sync, and discard. */
function productToUploadedMedia(
  product: SerializedProductWithRelations | undefined,
): PresignedUploadedMedia[] {
  return (
    product?.media.map((m) => ({
      key: m.key,
      url: m.url,
      mediaType: m.mediaType,
      mimeType: m.mimeType ?? undefined,
      thumbKey: m.thumbKey ?? undefined,
      posterUrl: m.thumbUrl ?? undefined,
      durationMs: m.durationMs ?? undefined,
      width: m.width ?? undefined,
      height: m.height ?? undefined,
    })) ?? []
  );
}

export function ProductForm({
  mode,
  product,
  brands = [],
  categoryTree = [],
  tags = [],
  attributeLibrary = [],
  categoryAttributeMap = {},
  onSuccess,
  redirectTo,
}: ProductFormProps) {
  const t = useTranslations("productForm");
  const boolFmt = useBoolFormat();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { rates, currency } = useCurrencyStore();
  const [isPending, startTransition] = useTransition();

  // Each PriceInput has its own inline currency selector, independent of the
  // other price fields - track what each is currently showing so the
  // saved-value hint below it can match (see PriceInput's onCurrencyChange).
  const [priceCurrency, setPriceCurrency] = useState<Currency>(currency);
  const [compareAtCurrency, setCompareAtCurrency] = useState<Currency>(currency);
  const [costCurrency, setCostCurrency] = useState<Currency>(currency);

  // The client Router Cache can serve a stale RSC payload when the user
  // returns to the edit page after a prior save (e.g. they changed the slug,
  // navigated away, and came back). That stale payload carries an outdated
  // optimistic-lock `version`, which makes the next save fail with a false
  // "modified by another user" conflict. Forcing a refresh on entry pulls the
  // current server state (the `version` is then re-synced into the form via
  // the `values` prop below). Guarded to update mode; create has no version.
  useEffect(() => {
    if (mode === "update") router.refresh();
    // Run once on mount; router is stable and mode never changes per instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  // Bumped by "Discard" to remount the per-locale sections, clearing the
  // `slugManuallyEdited` each of them owns privately (see handleDiscard).
  const [perLocaleResetKey, setPerLocaleResetKey] = useState(0);
  const [previewLocale, setPreviewLocale] = useState<Locale>(locale);
  const [activeTab, setActiveTab] = useState<string>("details");

  // Mirror the SEO preview locale onto the app locale when the user switches
  // the app language. The toggle starts on the app locale (initial state) and
  // any manual change the user makes inside the form is preserved across tab
  // switches; it only resets when the form is re-mounted.
  useEffect(() => {
    setPreviewLocale(locale);
  }, [locale]);

  const [uploadedMedia, setUploadedMedia] = useState<PresignedUploadedMedia[]>(
    () => productToUploadedMedia(product),
  );

  const schema = mode === "create" ? createProductSchema : updateProductSchema;

  // Live stock fetched from a non-cached endpoint (see the effect below). The
  // edit page is server-cached, so `product.stock` can be stale (orders mutate
  // stock after the page was cached). We fold the live value INTO the form
  // baseline via `derivedValues` rather than writing it as a `setValue` side
  // effect - the latter moved the field value without moving its default, so
  // RHF's value-vs-default `isDirty` check flagged the form as edited the moment
  // it opened. `null` here means "not fetched yet" (fall back to page stock).
  const [liveStock, setLiveStock] = useState<{
    stock: number | null;
    variants: Record<string, number>;
  } | null>(null);

  const derivedValues = useMemo<ProductFormData>(() => {
    if (!product) {
      return {
        title: "",
        slug: "",
        description: "",
        shortDescription: "",
        price: 0,
        compareAtPrice: null,
        costPrice: null,
        stock: null,
        barcode: "",
        taxable: true,
        taxCode: "",
        requiresShipping: true,
        isDigital: false,
        weight: null,
        weightUnit: null,
        length: null,
        width: null,
        height: null,
        dimensionUnit: null,
        metaTitle: "",
        metaDescription: "",
        translations: normalizeProductTranslations(null),
        brandId: undefined,
        categoryIds: [],
        tagIds: [],
        media: [],
        options: [],
        variants: [],
        attributes: [],
        version: 1,
      };
    }
    // Default-locale row carries the canonical title / slug / description that
    // the form's top-level fields are bound to. Falls back to an empty row when
    // - somehow - the product has no default-locale translation yet.
    const defaultProductT = product.translations.find((tr) => tr.locale === DEFAULT_LOCALE);
    const mediaKeyById = new Map(product.media.map((m) => [m.id, m.key]));
    return {
      title: defaultProductT?.title ?? "",
      slug: defaultProductT?.slug ?? "",
      description: defaultProductT?.description ?? "",
      shortDescription: defaultProductT?.shortDescription ?? "",
      price: product.price / 100,
      compareAtPrice: product.compareAtPrice != null ? product.compareAtPrice / 100 : null,
      costPrice: product.costPrice != null ? product.costPrice / 100 : null,
      // Prefer the live stock once fetched, so the baseline matches reality and
      // the form doesn't open pre-dirtied when the cached page stock is stale.
      stock: liveStock ? liveStock.stock : (product.stock ?? null),
      barcode: product.barcode ?? "",
      taxable: product.taxable ?? true,
      taxCode: product.taxCode ?? "",
      requiresShipping: product.requiresShipping ?? true,
      isDigital: product.isDigital ?? false,
      weight: product.weight ?? null,
      weightUnit: (product.weightUnit ?? null) as ProductFormData["weightUnit"],
      length: product.length ?? null,
      width: product.width ?? null,
      height: product.height ?? null,
      dimensionUnit: (product.dimensionUnit ?? null) as ProductFormData["dimensionUnit"],
      metaTitle: defaultProductT?.metaTitle ?? "",
      metaDescription: defaultProductT?.metaDescription ?? "",
      translations: normalizeProductTranslations(product.translations),
      brandId: product.brandId ?? undefined,
      categoryIds: product.categories.map((c) => c.categoryId),
      tagIds: product.tags.map((t) => t.tagId),
      media: product.media.map(toFormMedia),
      // Seeded from the saved variants so the pills open pre-checked AND have a
      // real baseline to be compared against (an empty array here would read as
      // "everything was just toggled on").
      options: buildOptionSelection(product.variants, attributeLibrary),
      variants: product.variants.map((v) => {
        const mediaKeys = v.media
          .map((vm) => mediaKeyById.get(vm.mediaId))
          .filter((k): k is string => Boolean(k));
        return {
          sku: v.sku,
          price: v.price / 100,
          compareAtPrice: v.compareAtPrice != null ? v.compareAtPrice / 100 : null,
          costPrice: v.costPrice != null ? v.costPrice / 100 : null,
          stock: liveStock?.variants[v.id] ?? v.stock,
          barcode: v.barcode ?? "",
          weight: v.weight ?? null,
          weightUnit: (v.weightUnit ?? null) as ProductFormData["weightUnit"],
          mediaKeys,
          options: v.attributeValues.map((av) => ({
            attributeId: av.attributeId,
            optionId: av.optionId,
          })),
        };
      }),
      attributes: buildAttributeEntries(product.attributeValues ?? []),
      version: product.version,
    };
    // `attributeLibrary` is a dependency because the option-pill baseline is
    // ordered by it; it's server-supplied and stable per page load, so this
    // doesn't add churn.
  }, [product, liveStock, attributeLibrary]);

  // When a draft is restored after a language switch (see the draft block below)
  // this holds the restored values and becomes the controlled `values` source, so
  // the on-mount router.refresh() can't re-sync the form back to server data and
  // wipe the user's in-progress edits.
  const [restoredValues, setRestoredValues] = useState<ProductFormData | null>(null);

  const form = useForm<ProductFormData, unknown, ProductFormData>({
    // Validate on every change so errors surface immediately and `hasErrors`
    // can gate the save button (consistent with every other admin form - no
    // "submit then toast"). RHF would otherwise default to "onSubmit".
    mode: "onChange",
    resolver: useZodResolver(schema) as unknown as Resolver<ProductFormData, unknown, ProductFormData>,
    defaultValues: derivedValues,
    // In update mode, re-sync the form when the underlying product changes.
    // keepDirtyValues lets the on-mount router.refresh() pull a fresh server
    // `version` without clobbering in-progress typing. After a language-switch
    // draft restore we pin `values` to the restored draft.
    values: mode === "update" ? (restoredValues ?? derivedValues) : undefined,
    resetOptions: { keepDirtyValues: true },
  });

  const watchedVariants = useWatch({ control: form.control, name: "variants" });
  const watchedTitle = useWatch({ control: form.control, name: "title" });
  const watchedSlug = useWatch({ control: form.control, name: "slug" });
  const watchedOptionSelection = useWatch({ control: form.control, name: "options" });
  const watchedRequiresShipping = useWatch({ control: form.control, name: "requiresShipping" });
  const watchedIsDigital = useWatch({ control: form.control, name: "isDigital" });

  // Auto-generate slug from title when not manually edited
  const prevTitleRef = useRef(form.getValues("title"));
  // `useFormState` (not `form.formState.defaultValues` directly) - the React
  // Compiler treats `form` as a stable dependency and can cache a stale
  // snapshot of the proxy read otherwise (see the identical fix in
  // VariantsEditor.tsx).
  const { defaultValues: savedTopLevelValues } = useFormState({ control: form.control });
  useEffect(() => {
    if (slugManuallyEdited) return;
    if (watchedTitle === prevTitleRef.current) return;
    prevTitleRef.current = watchedTitle;
    const saved = savedTopLevelValues;
    form.setValue(
      "slug",
      deriveOrRestore(watchedTitle, saved?.title, saved?.slug, slugify),
      { shouldDirty: true },
    );
    // Baseline read only - see the per-locale section for why it stays out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedTitle, slugManuallyEdited, form]);

  // See the per-locale section: `deriveOrRestore`, not a bare `slugify`, so
  // regenerating while the title is unchanged restores the SAVED slug instead
  // of an un-suffixed one the record already owns.
  const autoSlug = deriveOrRestore(
    watchedTitle,
    savedTopLevelValues?.title,
    savedTopLevelValues?.slug,
    slugify,
  );
  const canRegenerateSlug = slugManuallyEdited && (watchedSlug ?? "") !== autoSlug;

  // --- Draft persistence across a language switch -----------------------------
  // A locale change navigates /sr/... -> /en/... which remounts this whole subtree
  // and would wipe every field, the active tab and uploaded media. The switcher
  // leaves a one-shot marker; when we see it on mount we restore the snapshot from
  // the previous (pre-switch) render. Any other navigation starts clean, and the
  // draft is cleared on a successful save. Keyed per form instance so /new and each
  // edited product never share a draft.
  const draftKey = `productForm:${mode === "update" && product ? product.id : "new"}`;
  const draftReady = useRef(false);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const uploadedMediaRef = useRef(uploadedMedia);
  uploadedMediaRef.current = uploadedMedia;
  const slugEditedRef = useRef(slugManuallyEdited);
  slugEditedRef.current = slugManuallyEdited;

  const persistDraft = useCallback(() => {
    if (!draftReady.current) return;
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({
          values: form.getValues(),
          tab: activeTabRef.current,
          media: uploadedMediaRef.current,
          slugManuallyEdited: slugEditedRef.current,
        }),
      );
    } catch {
      // sessionStorage full / unavailable - draft is best-effort.
    }
  }, [draftKey, form]);

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  }, [draftKey]);

  // Restore on a language switch. Runs on mount AND whenever the locale changes,
  // so it works whether the switch remounted the tree or (after the switcher's
  // hard reload for form pages) mounted it fresh. consumeLanguageSwitch is
  // one-shot + time-boxed, so only a real switch restores; a normal first entry
  // just clears any stale draft.
  const firstMountRef = useRef(true);
  useEffect(() => {
    if (consumeLanguageSwitch()) {
      try {
        const raw = sessionStorage.getItem(draftKey);
        if (raw) {
          const draft = JSON.parse(raw) as {
            values: ProductFormData;
            tab: string;
            media: PresignedUploadedMedia[];
            slugManuallyEdited: boolean;
          };
          form.reset(draft.values);
          if (mode === "update") setRestoredValues(draft.values);
          setActiveTab(draft.tab);
          setUploadedMedia(draft.media);
          setSlugManuallyEdited(draft.slugManuallyEdited);
        }
      } catch {
        // malformed draft - fall back to server / default values.
      }
    } else if (firstMountRef.current) {
      clearDraft();
    }
    firstMountRef.current = false;
    draftReady.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, locale]);

  // Flag this page so the locale switcher does a hard navigation instead of a
  // soft one - otherwise Next's Router Cache restores the previous locale's tree
  // (with stale client state) on back-navigation and bypasses the restore above.
  useEffect(() => {
    setPreserveAcrossLocaleSwitch(true);
    return () => setPreserveAcrossLocaleSwitch(false);
  }, []);

  // Mirror field edits into the draft (form.watch fires on change, not on mount).
  useEffect(() => {
    const sub = form.watch(() => persistDraft());
    return () => sub.unsubscribe();
  }, [form, persistDraft]);

  // Mirror the non-RHF pieces (tab / media / slug flag) into the draft.
  useEffect(() => {
    persistDraft();
  }, [activeTab, uploadedMedia, slugManuallyEdited, persistDraft]);
  // ----------------------------------------------------------------------------

  // Pull live stock (page is cached, so `product.stock` can be stale) and feed
  // it into `derivedValues` as the form baseline. Routing it through state -
  // not a `setValue` - keeps the field value and its default in lock-step, so a
  // stock change since the page was cached no longer opens the form pre-dirtied.
  useEffect(() => {
    if (mode !== "update" || !product) return;

    const productId = product.id;
    let cancelled = false;

    axios.get<{ stock: number | null; variants: { id: string; stock: number }[] }>(
        `/api/admin/products/${productId}/stock`
      )
      .then(({ data }) => {
        if (cancelled) return;
        setLiveStock({
          stock: data.stock,
          variants: Object.fromEntries(data.variants.map((v) => [v.id, v.stock])),
        });
      })
      .catch(() => {});

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // Tracks whether the uploadedMedia -> form sync has run once. The first run is
  // the initial mount (and post-product-change re-seed), which must NOT mark the
  // form dirty; later runs are genuine user media edits and do.
  const mediaSyncedRef = useRef(false);

  // Re-sync local UI state (not in RHF) when the product reference changes -
  // happens on navigation back to the edit page. Skips the initial mount to
  // avoid redundant state writes.
  const productRef = useRef(product);
  useEffect(() => {
    if (productRef.current === product) return;
    productRef.current = product;
    if (!product) return;
    setSlugManuallyEdited(false);
    prevTitleRef.current =
      product.translations.find((tr) => tr.locale === DEFAULT_LOCALE)?.title ?? "";
    // The product changed (e.g. a post-save refresh) - the media re-seed that
    // follows is a new baseline, not a user edit, so don't let it mark dirty.
    mediaSyncedRef.current = false;
    setUploadedMedia(productToUploadedMedia(product));
  }, [product]);

  // Mirror uploadedMedia into the form value + prune any variant→media
  // references that point at removed keys. Driven by an effect so the upload
  // component can stay controlled (parent owns the state, which is what keeps
  // the media alive across tab unmounts).
  //
  // The first run is the initial mount sync (media seeded from server data), so
  // it must NOT mark the form dirty - otherwise the edit page opens already
  // showing "unsaved changes". Subsequent runs are real user media edits and DO
  // mark dirty so the save bar appears.
  useEffect(() => {
    const shouldDirty = mediaSyncedRef.current;
    form.setValue("media", uploadedMedia.map(toFormMedia), { shouldDirty });
    const validKeys = new Set(uploadedMedia.map((m) => m.key));
    const currentVariants = form.getValues("variants") ?? [];
    currentVariants.forEach((variant, index) => {
      const current = variant.mediaKeys ?? [];
      const filtered = current.filter((k) => validKeys.has(k));
      if (filtered.length !== current.length) {
        form.setValue(`variants.${index}.mediaKeys`, filtered, { shouldDirty });
      }
    });
    mediaSyncedRef.current = true;
  }, [uploadedMedia, form]);

  // `form.formState.x` is a proxy getter - its value changes without the
  // `form` object's own reference ever changing, which the React Compiler's
  // memoization can't see: it treats `form` as a stable dependency and
  // caches whatever `form.formState.x` returned on the first read, leaving
  // isDirty/errors/dirtyFields stuck stale after the very first render.
  // `useFormState` is a real hook call - the compiler tracks it correctly -
  // and is the react-hook-form-documented way to read formState reactively
  // (see the identical fix in VariantsEditor.tsx).
  const { errors, dirtyFields: dirty } = useFormState({ control: form.control });

  // NOT react-hook-form's `isDirty`: that flag is only recomputed inside the
  // write that triggered it, so a value written in a follow-up step (the
  // auto-derived slug) is never accounted for and the flag stays stuck on.
  // Comparing values against the baseline has no such ordering hazard.
  const isDirty = useIsFormDirty(form.control);

  // Tab error indicators
  const detailsHasError = !!(errors.title || errors.slug || errors.description || errors.shortDescription);
  const pricingHasError = !!(errors.price || errors.compareAtPrice || errors.costPrice || errors.stock || errors.barcode || errors.taxCode);
  const shippingHasError = !!(errors.weight || errors.length || errors.width || errors.height);
  const seoHasError = !!(errors.metaTitle || errors.metaDescription);
  const variantsHasError = !!errors.variants;

  // Per-tab "edited" indicators (update mode only - in create everything reads
  // dirty against empty defaults, so the dots would be meaningless).
  // Block saving while any field is invalid. Error-based (not `!isValid`) so a
  // freshly-loaded valid product isn't disabled before the first validation runs.
  const hasErrors = Object.keys(errors).length > 0;
  const showChanges = mode === "update";
  // Translations are a single nested object spanning multiple tabs (Details owns
  // title/slug/short/description, SEO owns metaTitle/metaDescription). Check the
  // relevant per-locale subfields so an SEO edit doesn't light up the Details tab.
  const translationsDirty = (keys: string[]) => {
    const td = dirty.translations as
      | Record<string, Record<string, unknown> | undefined>
      | undefined;
    if (!td) return false;
    return Object.values(td).some((loc) => loc && keys.some((k) => Boolean(loc[k])));
  };
  const detailsHasChanges =
    showChanges &&
    !!(
      dirty.title ||
      dirty.slug ||
      dirty.description ||
      dirty.shortDescription ||
      dirty.categoryIds ||
      dirty.tagIds ||
      dirty.brandId ||
      dirty.attributes ||
      dirty.media ||
      translationsDirty(["title", "slug", "shortDescription", "description"])
    );
  const pricingHasChanges = showChanges && !!(dirty.price || dirty.compareAtPrice || dirty.costPrice || dirty.stock || dirty.barcode || dirty.taxable || dirty.taxCode);
  const shippingHasChanges = showChanges && !!(dirty.isDigital || dirty.requiresShipping || dirty.weight || dirty.weightUnit || dirty.length || dirty.width || dirty.height || dirty.dimensionUnit);
  const seoHasChanges =
    showChanges &&
    !!(dirty.metaTitle || dirty.metaDescription || translationsDirty(["metaTitle", "metaDescription"]));
  // Compared by content against a baseline that mirrors `derivedValues`' live-stock
  // preference (see `savedVariantsBaseline` below), so an async stock refresh
  // doesn't falsely diverge from the baseline while a real user edit still does.
  // RHF's own `dirty.variants` is NOT used here: the live-stock refresh feeds a
  // new `derivedValues` into the form's `values` prop, and that reset - combined
  // with an unrelated field (e.g. media) being set dirty in the same tick - can
  // spuriously mark the whole `variants` array dirty even when nothing in it
  // actually changed (observed as this tab lighting up merely from adding a
  // product image, inconsistently depending on whether the product already had
  // media). Comparing real content sidesteps that timing-dependent false positive.
  const savedVariantsBaseline = useMemo(() => {
    if (!product) return [];
    const mediaKeyById = new Map(product.media.map((m) => [m.id, m.key]));
    return product.variants.map((v) => ({
      sku: v.sku,
      price: v.price / 100,
      compareAtPrice: v.compareAtPrice != null ? v.compareAtPrice / 100 : null,
      costPrice: v.costPrice != null ? v.costPrice / 100 : null,
      // Mirrors `derivedValues`' live-stock preference so this only diverges
      // from `watchedVariants` on a real user edit, not on the async refresh.
      stock: liveStock?.variants[v.id] ?? v.stock,
      barcode: v.barcode ?? "",
      weight: v.weight ?? null,
      weightUnit: (v.weightUnit ?? null) as ProductFormData["weightUnit"],
      mediaKeys: v.media
        .map((vm) => mediaKeyById.get(vm.mediaId))
        .filter((k): k is string => Boolean(k)),
      options: v.attributeValues.map((av) => ({
        attributeId: av.attributeId,
        optionId: av.optionId,
      })),
    }));
  }, [product, liveStock]);
  // Baseline for the option pills, mirroring `derivedValues.options`.
  const savedOptionSelection = useMemo(
    () => (product ? buildOptionSelection(product.variants, attributeLibrary) : []),
    [product, attributeLibrary],
  );
  const variantsHasChanges = useMemo(() => {
    if (!showChanges) return false;
    if (
      JSON.stringify(watchedVariants) !==
      JSON.stringify(savedVariantsBaseline as typeof watchedVariants)
    ) {
      return true;
    }
    // The pill selection counts as an edit in its own right: it can legitimately
    // differ from the generated variants (that IS the "needs regenerate" state),
    // so comparing only `variants` left toggling a pill invisible to this tab.
    return (
      JSON.stringify(watchedOptionSelection ?? []) !==
      JSON.stringify(savedOptionSelection)
    );
  }, [
    showChanges,
    watchedVariants,
    savedVariantsBaseline,
    watchedOptionSelection,
    savedOptionSelection,
  ]);

  useUnsavedChangesWarning(showChanges && isDirty);

  // Discard: restore the form, its media and the per-locale sections back to
  // the saved server baseline. Anything living in React state rather than in
  // the form survives `form.reset()`, so each such piece is reverted by hand
  // below. The active tab is deliberately left alone - staying where you were
  // after discarding is less disorienting than being thrown back to Details.
  const handleDiscard = () => {
    mediaSyncedRef.current = false;
    setRestoredValues(null);
    setUploadedMedia(productToUploadedMedia(product));
    setSlugManuallyEdited(false);
    // Each PerLocaleProductSection owns its own `slugManuallyEdited`, which
    // neither `form.reset()` (React state, not form state) nor the line above
    // (top-level only) can clear. Without this, discarding after a hand-edited
    // translated slug left that locale stuck in manual mode: retyping the
    // title no longer regenerated its slug. Bumping the key remounts just
    // those sections, so the active tab, uploaded media and fetched live stock
    // all survive - unlike the whole-form remount the other admin forms use.
    setPerLocaleResetKey((k) => k + 1);
    // Explicit `keepDirtyValues: false`: a bare `form.reset()` MERGES the
    // useForm-level `resetOptions` ({ keepDirtyValues: true }, there so the
    // on-mount router.refresh doesn't wipe edits), which would make discard keep
    // every edited value - i.e. do nothing. Override it to force a clean revert.
    form.reset(derivedValues, { keepDirtyValues: false });
  };

  // Saved-value formatters for the changed-field hints on the relation pickers.
  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    const walk = (items: CategoryTreeItem[]) => {
      for (const c of items) {
        map.set(c.id, getCategoryName(c, locale));
        walk(c.children);
      }
    };
    walk(categoryTree);
    return map;
  }, [categoryTree, locale]);

  const fmtCategoryIds = (v: unknown) => {
    if (!Array.isArray(v) || v.length === 0) return "-";
    return v.map((id) => categoryNameById.get(id as string) ?? String(id)).join(", ");
  };

  const tagNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const tg of tags) map.set(tg.id, getTagName(tg, locale));
    return map;
  }, [tags, locale]);

  const fmtTagIds = (v: unknown) => {
    if (!Array.isArray(v) || v.length === 0) return "-";
    return v.map((id) => tagNameById.get(id as string) ?? String(id)).join(", ");
  };

  const fmtBrandId = (v: unknown) => {
    const b = brands.find((x) => x.id === v);
    if (!b) return "-";
    // `getBrandName` (not a raw `find(locale)?.name ?? ...`) - a locale can
    // HAVE a translation row whose name was left blank, and `??` would then
    // hand back that empty string instead of falling back to English.
    return getBrandName(b, locale) || "-";
  };

  // Product prices live in USD-base dollars in the form, but the saved-value
  // hint should match whatever currency that field's PriceInput is currently
  // showing (tracked above via onCurrencyChange) - not raw USD, which read
  // as a mismatch against the input and its own inline "≈ USD" helper line
  // whenever the display currency wasn't USD.
  const fmtPrice = (fieldCurrency: Currency) => (v: unknown) =>
    formatPrice(
      convertCents(decimalToCents(Number(v)), fieldCurrency, rates[fieldCurrency] ?? 1),
      fieldCurrency,
    );
  const fmtStock = (v: unknown) => (v == null ? t("unlimited") : String(v));

  const onSubmit = (data: ProductFormData) => {
    startTransition(async () => {
      let result;

      const translationsPayload = buildProductTranslationsPayload(data.translations);

      if (mode === "create") {
        const createData: CreateProductInput = {
          title: data.title,
          slug: data.slug || undefined,
          description: data.description,
          shortDescription: data.shortDescription || undefined,
          price: data.price,
          compareAtPrice: data.compareAtPrice,
          costPrice: data.costPrice,
          stock: data.variants.length === 0 ? data.stock : null,
          barcode: data.barcode || undefined,
          taxable: data.taxable,
          taxCode: data.taxCode || undefined,
          requiresShipping: data.requiresShipping,
          isDigital: data.isDigital,
          weight: data.weight,
          weightUnit: data.weightUnit,
          length: data.length,
          width: data.width,
          height: data.height,
          dimensionUnit: data.dimensionUnit,
          metaTitle: data.metaTitle || undefined,
          metaDescription: data.metaDescription || undefined,
          translations: translationsPayload,
          brandId: data.brandId || undefined,
          categoryIds: data.categoryIds,
          tagIds: data.tagIds,
          media: data.media,
          variants: data.variants,
          attributes: data.attributes,
        };
        result = await createProduct(createData, redirectTo);
      } else {
        const updateData: UpdateProductInput = {
          ...(data as UpdateProductInput),
          translations: translationsPayload,
        };
        result = await updateProduct(
          product!.id,
          updateData,
          redirectTo,
        );
      }

      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        clearDraft();
        toast.success(mode === "create" ? t("created") : t("updated"));
        onSuccess?.();
      }
    });
  };

  const onSubmitInvalid = (formErrors: FieldErrors<ProductFormData>) => {
    const tabs: string[] = [];
    if (formErrors.title || formErrors.slug || formErrors.description || formErrors.shortDescription) tabs.push(t("tabDetails"));
    if (formErrors.price || formErrors.compareAtPrice || formErrors.costPrice || formErrors.stock || formErrors.barcode || formErrors.taxCode) tabs.push(t("tabPricing"));
    if (formErrors.weight || formErrors.length || formErrors.width || formErrors.height) tabs.push(t("tabShipping"));
    if (formErrors.metaTitle || formErrors.metaDescription) tabs.push(t("tabSeo"));
    if (formErrors.variants) tabs.push(t("tabOptions"));

    const messages = collectFormErrorMessages(formErrors);
    const first = messages[0];
    const tabList = tabs.join(", ");
    if (first && tabList) {
      toast.error(t("validationFailedOnTabs", { tabs: tabList, message: first }));
    } else if (first) {
      toast.error(first);
    } else {
      toast.error(t("validationFailed"));
    }
  };

  function TabLabel({
    label,
    hasError,
    hasChanges,
  }: {
    label: string;
    hasError: boolean;
    hasChanges?: boolean;
  }) {
    return (
      <span className="flex items-center gap-1.5">
        {label}
        {hasError ? (
          <AlertCircle className="w-3 h-3 text-destructive" />
        ) : hasChanges ? (
          <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
        ) : null}
      </span>
    );
  }

  return (
    <Form {...form}>
      <ChangedHintScope enabled={mode === "update"}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit, onSubmitInvalid)} className="flex-1 flex flex-col min-h-0">
        <RequiredFieldsNote />
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0">
          {/* `h-auto!`: TabsList's own `h-8` is a `group-data-horizontal/tabs:`
              variant utility, which beats a plain `h-auto` override on CSS
              specificity - without `!important` the list stays clipped to one
              row's height on narrow screens, so a wrapped tab renders outside
              its own `bg-muted` pill background as bare text.
              `*:h-7.75!`: each TabsTrigger sizes itself off the list's OWN
              height (`h-[calc(100%-1px)]`) rather than a fixed value. Once
              the list's height is no longer the fixed `h-8` it wrapped
              against, that turns circular - the list's height depends on its
              (now taller) children, which depend right back on the list's
              height - and every trigger, not just the wrapped one, blew up to
              the full multi-row height. Pinning each trigger's height breaks
              the loop; 7.75 (31px) matches what `calc(100% - 1px)` resolved to
              when the list was a fixed `h-8` (32px). */}
          <TabsList className="w-full justify-start flex-wrap h-auto! gap-1 shrink-0 *:h-7.75!">
            <TabsTrigger value="details">
              <TabLabel label={t("tabDetails")} hasError={detailsHasError} hasChanges={detailsHasChanges} />
            </TabsTrigger>
            <TabsTrigger value="pricing">
              <TabLabel label={t("tabPricing")} hasError={pricingHasError} hasChanges={pricingHasChanges} />
            </TabsTrigger>
            <TabsTrigger value="shipping">
              <TabLabel label={t("tabShipping")} hasError={shippingHasError} hasChanges={shippingHasChanges} />
            </TabsTrigger>
            <TabsTrigger value="seo">
              <TabLabel label={t("tabSeo")} hasError={seoHasError} hasChanges={seoHasChanges} />
            </TabsTrigger>
            <TabsTrigger value="variants">
              <TabLabel label={t("tabOptions")} hasError={variantsHasError} hasChanges={variantsHasChanges} />
            </TabsTrigger>
          </TabsList>

          {/* ── DETAILS TAB ── */}
          <TabsContent value="details" className="space-y-6 pt-4 overflow-y-auto min-h-0 pb-6">
            {/* English (default) */}
            <div className="rounded-md border border-border/60 p-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {LOCALE_LABELS[DEFAULT_LOCALE].emoji} {LOCALE_LABELS[DEFAULT_LOCALE].label}
              </p>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>{t("titleField")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("titlePlaceholder")} {...field} />
                    </FormControl>
                    <FieldChangedHint />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("slug")}</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          placeholder={t("slugPlaceholder")}
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
                        entity="product"
                        locale={DEFAULT_LOCALE}
                        slug={field.value}
                        excludeId={product?.id}
                        autoResolves={mode === "create"}
                      />
                    </div>
                    <FieldChangedHint />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shortDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("shortDesc")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("shortDescPlaceholder")} {...field} />
                    </FormControl>
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
                    <FormLabel required>{t("description")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("descPlaceholder")}
                        className="min-h-30"
                        {...field}
                      />
                    </FormControl>
                    <FieldChangedHint />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Translation sections - one per non-default locale */}
            {NON_DEFAULT_LOCALES.map((loc) => (
              <PerLocaleProductSection
                // `perLocaleResetKey` remounts these on Discard so each
                // section's private `slugManuallyEdited` goes back to false.
                key={`${loc}-${perLocaleResetKey}`}
                locale={loc}
                form={form}
                fallbackTitle={form.watch("title") ?? ""}
                fallbackShortDescription={form.watch("shortDescription") ?? ""}
                fallbackDescription={form.watch("description") ?? ""}
                excludeId={product?.id}
                autoResolvesSlug={mode === "create"}
                t={t}
              />
            ))}

            {categoryTree.length > 0 && (
              <FormField
                control={form.control}
                name="categoryIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("categories")}</FormLabel>
                    <FormControl>
                      <CategoryPicker
                        tree={categoryTree}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FieldChangedHint format={fmtCategoryIds} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {tags.length > 0 && (
              <FormField
                control={form.control}
                name="tagIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("tags")}</FormLabel>
                    <FormControl>
                      <TagPicker
                        options={tags}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FieldChangedHint format={fmtTagIds} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <ProductAttributesField
              form={form}
              attributeLibrary={attributeLibrary}
              categoryAttributeMap={categoryAttributeMap}
              categoryTree={categoryTree}
            />

            {brands.length > 0 && (
              <FormField
                control={form.control}
                name="brandId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("brand")}</FormLabel>
                    <FormControl>
                      <BrandSelect
                        brands={brands}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FieldChangedHint format={fmtBrandId} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Separator />

            <div className="space-y-2">
              <FormLabel className="text-base font-semibold">{t("media")}</FormLabel>
              <ProductMediaUpload
                media={uploadedMedia}
                setMedia={setUploadedMedia}
              />
            </div>
          </TabsContent>

          {/* ── PRICING & INVENTORY TAB ── */}
          <TabsContent value="pricing" className="space-y-6 pt-4 overflow-y-auto min-h-0 pb-6">
            <p className="text-xs text-muted-foreground">{t("pricingCurrencyNote")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>{t("price")}</FormLabel>
                    <FormControl>
                      <PriceInput value={field.value} onChange={field.onChange} onBlur={field.onBlur} rates={rates} defaultCurrency={currency} onCurrencyChange={setPriceCurrency} />
                    </FormControl>
                    <FieldChangedHint format={fmtPrice(priceCurrency)} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="compareAtPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("compareAtPrice")}</FormLabel>
                    <FormControl>
                      <PriceInput value={field.value ?? 0} onChange={(v) => field.onChange(v || null)} onBlur={field.onBlur} rates={rates} defaultCurrency={currency} onCurrencyChange={setCompareAtCurrency} />
                    </FormControl>
                    <FormDescription>{t("compareAtDesc")}</FormDescription>
                    <FieldChangedHint format={fmtPrice(compareAtCurrency)} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("costPrice")}</FormLabel>
                    <FormControl>
                      <PriceInput value={field.value ?? 0} onChange={(v) => field.onChange(v || null)} onBlur={field.onBlur} rates={rates} defaultCurrency={currency} onCurrencyChange={setCostCurrency} />
                    </FormControl>
                    <FormDescription>{t("costDesc")}</FormDescription>
                    <FieldChangedHint format={fmtPrice(costCurrency)} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {watchedVariants?.length === 0 ? (
              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("stock")}
                      <span className="ml-1.5 font-normal text-muted-foreground">- {t("unlimitedHint")}</span>
                    </FormLabel>
                    <FormControl>
                      <NumberStepper
                        min={0}
                        allowEmpty
                        placeholder={t("unlimited")}
                        value={field.value ?? null}
                        onChange={(v) => field.onChange(v)}
                      />
                    </FormControl>
                    <FieldChangedHint format={fmtStock} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              // Variant products track stock per ProductVariant.stock - showing a
              // top-level stock input here would mislead users into editing a value
              // that checkout/PDP never reads.
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t("stockManagedByVariants")}</AlertTitle>
                <AlertDescription className="flex flex-col gap-2">
                  <span>
                    {t("stockManagedByVariantsDesc", { count: watchedVariants?.length ?? 0 })}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => setActiveTab("variants")}
                  >
                    {t("goToVariants")}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="barcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("barcode")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("barcodePlaceholder")} {...field} />
                  </FormControl>
                  <FieldChangedHint />
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">{t("tax")}</h3>

              <FormField
                control={form.control}
                name="taxable"
                render={({ field }) => (
                  <FormItem className="rounded-lg border p-4 bg-background dark:bg-input/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <FormLabel className="text-base">{t("chargeTaxes")}</FormLabel>
                        <FormDescription>
                          {t("chargeTaxesDesc")}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </div>
                    <FieldChangedHint format={boolFmt} />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("taxCode")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("taxCodePlaceholder")} {...field} />
                    </FormControl>
                    <FormDescription>
                      {t("taxCodeDesc")}
                    </FormDescription>
                    <FieldChangedHint />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          {/* ── SHIPPING TAB ── */}
          <TabsContent value="shipping" className="space-y-6 pt-4 overflow-y-auto min-h-0 pb-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="isDigital"
                render={({ field }) => (
                  <FormItem className="rounded-lg border p-4 bg-background dark:bg-input/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <FormLabel className="text-base">{t("digitalProduct")}</FormLabel>
                        <FormDescription>
                          {t("digitalDesc")}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(val) => {
                            field.onChange(val);
                            if (val) form.setValue("requiresShipping", false);
                          }}
                        />
                      </FormControl>
                    </div>
                    <FieldChangedHint format={boolFmt} />
                  </FormItem>
                )}
              />

              {!watchedIsDigital && (
                <FormField
                  control={form.control}
                  name="requiresShipping"
                  render={({ field }) => (
                    <FormItem className="rounded-lg border p-4 bg-background dark:bg-input/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <FormLabel className="text-base">{t("requiresShipping")}</FormLabel>
                          <FormDescription>
                            {t("requiresShippingDesc")}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </div>
                      <FieldChangedHint format={boolFmt} />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {(watchedRequiresShipping && !watchedIsDigital) && (
              <>
                <Separator />

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">{t("weight")}</h3>
                  <div className="flex gap-3">
                    <FormField
                      control={form.control}
                      name="weight"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>{t("weight")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))
                              }
                            />
                          </FormControl>
                          <FieldChangedHint />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="weightUnit"
                      render={({ field }) => (
                        <FormItem className="w-24">
                          <FormLabel>{t("unit")}</FormLabel>
                          <Select
                            value={field.value ?? ""}
                            onValueChange={(val) => field.onChange(val || null)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                {/* Explicit label so it shows pre-hydration. */}
                                <SelectValue placeholder="-">
                                  {WEIGHT_UNITS.find((u) => u.value === field.value)?.label ?? "-"}
                                </SelectValue>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {WEIGHT_UNITS.map((u) => (
                                <SelectItem key={u.value} value={u.value}>
                                  {u.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldChangedHint
                            format={(v) => WEIGHT_UNITS.find((u) => u.value === v)?.label ?? String(v)}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">{t("dimensions")}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(["length", "width", "height"] as const).map((dim) => (
                      <FormField
                        key={dim}
                        control={form.control}
                        name={dim}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t(dim)}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))
                                }
                              />
                            </FormControl>
                            <FieldChangedHint />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                    <FormField
                      control={form.control}
                      name="dimensionUnit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("unit")}</FormLabel>
                          <Select
                            value={field.value ?? ""}
                            onValueChange={(val) => field.onChange(val || null)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                {/* Explicit label so it shows pre-hydration. */}
                                <SelectValue placeholder="-">
                                  {DIMENSION_UNITS.find((u) => u.value === field.value)?.label ?? "-"}
                                </SelectValue>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DIMENSION_UNITS.map((u) => (
                                <SelectItem key={u.value} value={u.value}>
                                  {u.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldChangedHint
                            format={(v) => DIMENSION_UNITS.find((u) => u.value === v)?.label ?? String(v)}
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* ── SEO TAB ── */}
          <TabsContent value="seo" className="space-y-6 pt-4 overflow-y-auto min-h-0 pb-6">
            <p className="text-sm text-muted-foreground">
              {t("seoHint")}
            </p>

            {/* English (default) */}
            <div className="rounded-md border border-border/60 p-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {LOCALE_LABELS[DEFAULT_LOCALE].emoji} {LOCALE_LABELS[DEFAULT_LOCALE].label}
              </p>

              <FormField
                control={form.control}
                name="metaTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("metaTitle")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={form.watch("title") || t("metaTitlePlaceholder")}
                        maxLength={70}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("charsRecommended", { count: field.value?.length ?? 0, max: 70 })}
                    </FormDescription>
                    <FieldChangedHint />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="metaDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("metaDescription")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("metaDescPlaceholder")}
                        maxLength={160}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t("charsRecommended", { count: field.value?.length ?? 0, max: 160 })}
                    </FormDescription>
                    <FieldChangedHint />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Translation sections - one per non-default locale */}
            {NON_DEFAULT_LOCALES.map((loc) => (
              <div key={loc} className="rounded-md border border-border/60 p-4 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {LOCALE_LABELS[loc].emoji} {LOCALE_LABELS[loc].label}
                  <span className="ml-1.5 font-normal text-muted-foreground normal-case tracking-normal">- {t("optional")}</span>
                </p>

                <FormField
                  control={form.control}
                  name={`translations.${loc}.metaTitle` as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("metaTitle")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={form.watch(`translations.${loc}.title` as const) || t("metaTitlePlaceholder")}
                          maxLength={70}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("charsRecommended", { count: field.value?.length ?? 0, max: 70 })}
                      </FormDescription>
                      <FieldChangedHint />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`translations.${loc}.metaDescription` as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("metaDescription")}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={form.watch(`translations.${loc}.shortDescription` as const) || t("metaDescPlaceholder")}
                          maxLength={160}
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("charsRecommended", { count: field.value?.length ?? 0, max: 160 })}
                      </FormDescription>
                      <FieldChangedHint />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}

            {/* Preview */}
            {(() => {
              const isDefault = previewLocale === DEFAULT_LOCALE;
              const tr = (key: "title" | "metaTitle" | "metaDescription" | "shortDescription" | "description") =>
                isDefault
                  ? undefined
                  : (form.watch(`translations.${previewLocale as NonDefaultLocale}.${key}` as const) as string | undefined);
              const base = (key: "title" | "metaTitle" | "metaDescription" | "shortDescription" | "description") =>
                form.watch(key) as string | undefined;

              const previewTitle = tr("metaTitle") || tr("title") || base("metaTitle") || base("title") || "";
              const previewDesc =
                tr("metaDescription") || tr("shortDescription") || tr("description") ||
                base("metaDescription") || base("shortDescription") || base("description") ||
                t("noDescription");
              const previewSlug = (form.watch("slug") as string | undefined) || "product-slug";

              if (!previewTitle) return null;

              return (
                <div className="rounded-lg border p-4 space-y-3 bg-background dark:bg-input/30">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {t("searchPreview")}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {SUPPORTED_LOCALES.map((loc) => (
                        <Button
                          key={loc}
                          type="button"
                          size="sm"
                          variant={previewLocale === loc ? "default" : "outline"}
                          onClick={() => setPreviewLocale(loc)}
                          className="h-7 px-2.5 text-xs"
                        >
                          <span className="mr-1">{LOCALE_LABELS[loc].emoji}</span>
                          {LOCALE_LABELS[loc].label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-base text-blue-600 font-medium truncate">{previewTitle}</p>
                    <p className="text-xs text-green-700">
                      example.com/products/{previewSlug}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{previewDesc}</p>
                  </div>
                </div>
              );
            })()}
          </TabsContent>

          {/* ── VARIANTS TAB ── */}
          {/* No pt-4 here: the VariantsEditor header is sticky and owns the top
              spacing, so the scroll container must have no top padding (a
              padding-top gap would let scrolled content show above the header). */}
          <TabsContent value="variants" className="space-y-6 overflow-y-auto min-h-0 pb-6">
            <VariantsEditor
              form={form}
              attributeLibrary={attributeLibrary}
              categoryAttributeMap={categoryAttributeMap}
              categoryTree={categoryTree}
              uploadedMedia={uploadedMedia}
            />
          </TabsContent>
        </Tabs>

        <div className="shrink-0 pt-4 pb-6 border-t">
          {mode === "update" ? (
            <FormSaveBar
              isDirty={isDirty}
              isPending={isPending}
              onDiscard={handleDiscard}
              saveLabel={t("update")}
              saveDisabled={hasErrors}
              sticky={false}
            />
          ) : (
            <Button type="submit" disabled={isPending || hasErrors} className="min-w-36">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("create")
              )}
            </Button>
          )}
        </div>
      </form>
      </ChangedHintScope>
    </Form>
  );
}