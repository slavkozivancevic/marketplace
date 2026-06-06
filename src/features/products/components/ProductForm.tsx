"use client";
import axios from "axios";

import { useEffect, useMemo, useRef, useState, useTransition, KeyboardEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useForm, useFieldArray, useWatch, Resolver, FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  VariantOptionTranslations,
} from "@/types/types";
import { NON_DEFAULT_LOCALES, LOCALE_LABELS, DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/i18n/config";

type NonDefaultLocale = (typeof NON_DEFAULT_LOCALES)[number];
import { X, Plus, RefreshCw, ImageOff, AlertCircle } from "lucide-react";
import Image from "next/image";
import { cn, slugify } from "@/lib/utils";
import { BrandSelect, type BrandOption } from "@/features/brands/components/BrandSelect";
import { SlugAvailabilityIndicator } from "@/components/admin/SlugAvailabilityIndicator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { getCategoryName } from "@/features/categories/utils/translations";
import type { CategoryTreeItem } from "@/features/categories/db/categories";
import { ProductAttributesField } from "./ProductAttributesField";
import type { AttributeSelectorItem } from "@/features/attributes/db/attributes";
import { useCurrencyStore } from "@/store/currency";
import { CURRENCIES } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";

/**
 * Price input with inline currency selector.
 * The form field always stores USD decimal (e.g. 18.43).
 * Seller can switch to any supported currency and type in that currency -
 * the value is auto-converted to USD for the form field.
 */
function PriceInput({
  value,
  onChange,
  rates,
  placeholder = "0.00",
  className,
  inputClassName,
}: {
  value: number;
  onChange: (usd: number) => void;
  rates: Record<string, number>;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}) {
  const [inputCurrency, setInputCurrency] = useState<Currency>("usd");
  const rate = inputCurrency === "usd" ? 1 : (rates[inputCurrency] ?? 1);

  // What the seller sees in the input box (in their chosen currency)
  const [displayValue, setDisplayValue] = useState<string>(value > 0 ? String(value) : "");

  const symbol = CURRENCIES.find((c) => c.code === inputCurrency)?.symbol ?? "$";

  const handleCurrencyChange = (newCurrency: Currency) => {
    const newRate = newCurrency === "usd" ? 1 : (rates[newCurrency] ?? 1);
    // Re-express the current USD form value in the new currency
    if (value > 0) {
      setDisplayValue((value * newRate).toFixed(2));
    }
    setInputCurrency(newCurrency);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(parsed / rate);
    } else {
      onChange(0);
    }
  };

  // Show the USD equivalent when seller is typing in a non-USD currency
  const usdEquivalent = inputCurrency !== "usd" && parseFloat(displayValue) > 0
    ? parseFloat(displayValue) / rate
    : null;

  return (
    <div className={className}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none pointer-events-none">
            {symbol}
          </span>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder={placeholder}
            className={cn(symbol.length <= 1 ? "pl-7" : symbol.length === 2 ? "pl-9" : "pl-12", inputClassName)}
            value={displayValue}
            onChange={handleChange}
          />
        </div>
        <Select value={inputCurrency} onValueChange={(v) => handleCurrencyChange(v as Currency)}>
          <SelectTrigger className="w-24 shrink-0">
            {/* Explicit label so it shows pre-hydration (Radix SelectContent
                is portaled and not yet available for value→item lookup). */}
            <SelectValue>
              {CURRENCIES.find((c) => c.code === inputCurrency)?.label ?? ""}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {usdEquivalent !== null && (
        <p className="text-xs text-muted-foreground mt-1">≈ ${usdEquivalent.toFixed(2)} USD</p>
      )}
    </div>
  );
}

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

type OptionTranslationsLocaleFields = {
  name: string;
  values: Record<string, string>;
};

type OptionTranslationsForm = Record<NonDefaultLocale, OptionTranslationsLocaleFields>;

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

function emptyOptionLocaleFields(): OptionTranslationsLocaleFields {
  return { name: "", values: {} };
}

function emptyOptionTranslations(): OptionTranslationsForm {
  return Object.fromEntries(
    NON_DEFAULT_LOCALES.map((loc) => [loc, emptyOptionLocaleFields()]),
  ) as OptionTranslationsForm;
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
    slot.slug = row.slug ?? "";
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

function buildOptionTranslationsPayload(
  form: OptionTranslationsForm,
): VariantOptionTranslations | null {
  const out: VariantOptionTranslations = {};
  let hasAny = false;
  for (const loc of NON_DEFAULT_LOCALES) {
    const slot = form[loc];
    const name = slot.name.trim();
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(slot.values)) {
      const trimmed = typeof v === "string" ? v.trim() : "";
      if (trimmed) values[k] = trimmed;
    }
    const localeHasAny = name.length > 0 || Object.keys(values).length > 0;
    if (localeHasAny) {
      out[loc] = {
        ...(name ? { name } : {}),
        ...(Object.keys(values).length > 0 ? { values } : {}),
      };
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
function normalizeOptionTranslations(
  rows: readonly {
    locale: string;
    name: string;
    values: unknown;
  }[] | null | undefined,
): OptionTranslationsForm {
  const result = emptyOptionTranslations();
  if (!rows) return result;
  for (const loc of NON_DEFAULT_LOCALES) {
    const row = rows.find((r) => r.locale === loc);
    if (!row) continue;
    const slot = result[loc];
    if (typeof row.name === "string") slot.name = row.name;
    const vals = row.values;
    if (Array.isArray(vals)) {
      vals.forEach((v, i) => {
        if (typeof v === "string") slot.values[String(i)] = v;
      });
    } else if (vals && typeof vals === "object") {
      for (const [k, v] of Object.entries(vals as Record<string, unknown>)) {
        if (typeof v === "string") slot.values[k] = v;
      }
    }
  }
  return result;
}

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
  media: {
    key: string;
    mediaType: "IMAGE" | "VIDEO";
    thumbKey?: string | null;
    mimeType?: string | null;
    durationMs?: number | null;
    width?: number | null;
    height?: number | null;
  }[];
  options: { name: string; values: string[]; translations: OptionTranslationsForm }[];
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
    options: { name: string; value: string }[];
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

type OptionSnapshot = { name: string; values: string[] };

function snapshotOptions(
  options: { name: string; values: string[] }[],
): OptionSnapshot[] {
  return options.map((o) => ({ name: o.name, values: [...o.values].sort() }));
}

function optionsAreSynced(
  current: { name: string; values: string[]; translations?: OptionTranslationsForm }[] | undefined,
  snapshot: OptionSnapshot[],
): boolean {
  if (!current) return true;
  if (current.length !== snapshot.length) return false;
  return current.every((opt, i) => {
    const snap = snapshot[i];
    if (!snap || opt.name !== snap.name) return false;
    const sorted = [...opt.values].sort();
    if (sorted.length !== snap.values.length) return false;
    return sorted.every((v, j) => v === snap.values[j]);
  });
}

function collectErrorMessages(errors: unknown): string[] {
  const messages: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message.length > 0) {
      messages.push(obj.message);
      return;
    }
    Object.values(obj).forEach(visit);
  };
  visit(errors);
  return messages;
}

function cartesianProduct(
  options: { name: string; values: string[]; translations?: OptionTranslationsForm }[],
): { name: string; value: string }[][] {
  const valid = options.filter((o) => o.name.trim() && o.values.length > 0);
  if (!valid.length) return [];
  return valid.reduce<{ name: string; value: string }[][]>(
    (acc, option) => {
      const result: { name: string; value: string }[][] = [];
      for (const combo of acc) {
        for (const value of option.values) {
          result.push([...combo, { name: option.name, value }]);
        }
      }
      return result;
    },
    [[]],
  );
}

interface ProductFormProps {
  mode: "create" | "update";
  product?: SerializedProductWithRelations;
  brands?: BrandOption[];
  categoryTree?: CategoryTreeItem[];
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
  t,
}: {
  locale: (typeof NON_DEFAULT_LOCALES)[number];
  form: ReturnType<typeof useForm<ProductFormData, unknown, ProductFormData>>;
  fallbackTitle: string;
  fallbackShortDescription: string;
  fallbackDescription: string;
  excludeId?: string;
  t: ReturnType<typeof useTranslations<"productForm">>;
}) {
  const titlePath = `translations.${locale}.title` as const;
  const slugPath = `translations.${locale}.slug` as const;
  const shortDescPath = `translations.${locale}.shortDescription` as const;
  const descPath = `translations.${locale}.description` as const;

  const titleValue = useWatch({ control: form.control, name: titlePath });
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const prevTitleRef = useRef<string | undefined>(form.getValues(titlePath));

  useEffect(() => {
    if (slugManuallyEdited) return;
    if (titleValue === prevTitleRef.current) return;
    prevTitleRef.current = titleValue;
    form.setValue(slugPath, slugify(titleValue ?? ""), { shouldDirty: false });
  }, [titleValue, slugManuallyEdited, form, slugPath]);

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
                    form.setValue(slugPath, slugify(form.getValues(titlePath) ?? ""));
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
              />
            </div>
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
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export function ProductForm({
  mode,
  product,
  brands = [],
  categoryTree = [],
  attributeLibrary = [],
  categoryAttributeMap = {},
  onSuccess,
  redirectTo,
}: ProductFormProps) {
  const t = useTranslations("productForm");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { rates } = useCurrencyStore();
  const [isPending, startTransition] = useTransition();

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
  const [previewLocale, setPreviewLocale] = useState<Locale>(locale);
  const [activeTab, setActiveTab] = useState("details");

  // Mirror the SEO preview locale onto the app locale when the user switches
  // the app language. The toggle starts on the app locale (initial state) and
  // any manual change the user makes inside the form is preserved across tab
  // switches; it only resets when the form is re-mounted.
  useEffect(() => {
    setPreviewLocale(locale);
  }, [locale]);

  const [uploadedMedia, setUploadedMedia] = useState<PresignedUploadedMedia[]>(
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
    })) ?? [],
  );

  const [optionValueInputs, setOptionValueInputs] = useState<string[]>(
    () => product?.options.map(() => "") ?? [],
  );

  const [syncedOptionsSnapshot, setSyncedOptionsSnapshot] = useState<OptionSnapshot[]>(
    () =>
      snapshotOptions(
        product?.options.map((opt) => ({
          name:
            opt.translations.find((tr) => tr.locale === DEFAULT_LOCALE)?.name ?? "",
          values: Array.from(new Set(opt.values.map((v) => v.value))),
        })) ?? [],
      ),
  );

  const schema = mode === "create" ? createProductSchema : updateProductSchema;

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
    const optionDefaultName = (opt: { translations: { locale: string; name: string }[] }) =>
      opt.translations.find((tr) => tr.locale === DEFAULT_LOCALE)?.name ?? "";
    const optionById = new Map(
      product.options.map((o) => [o.id, optionDefaultName(o)]),
    );
    const mediaKeyById = new Map(product.media.map((m) => [m.id, m.key]));
    return {
      title: defaultProductT?.title ?? "",
      slug: defaultProductT?.slug ?? "",
      description: defaultProductT?.description ?? "",
      shortDescription: defaultProductT?.shortDescription ?? "",
      price: product.price / 100,
      compareAtPrice: product.compareAtPrice != null ? product.compareAtPrice / 100 : null,
      costPrice: product.costPrice != null ? product.costPrice / 100 : null,
      stock: product.stock ?? null,
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
      media: product.media.map((m) => ({
        key: m.key,
        mediaType: m.mediaType,
        thumbKey: m.thumbKey,
        mimeType: m.mimeType,
        durationMs: m.durationMs,
        width: m.width,
        height: m.height,
      })),
      options: product.options.map((opt) => ({
        name: optionDefaultName(opt),
        values: Array.from(new Set(opt.values.map((v) => v.value))),
        translations: normalizeOptionTranslations(opt.translations),
      })),
      variants: product.variants.map((v) => {
        const seenOptionNames = new Set<string>();
        const dedupedOptions: { name: string; value: string }[] = [];
        for (const ov of v.optionValues) {
          const name = optionById.get(ov.optionId) ?? "";
          if (seenOptionNames.has(name)) continue;
          seenOptionNames.add(name);
          dedupedOptions.push({ name, value: ov.value });
        }
        const mediaKeys = v.media
          .map((vm) => mediaKeyById.get(vm.mediaId))
          .filter((k): k is string => Boolean(k));
        return {
          sku: v.sku,
          price: v.price / 100,
          compareAtPrice: v.compareAtPrice != null ? v.compareAtPrice / 100 : null,
          costPrice: v.costPrice != null ? v.costPrice / 100 : null,
          stock: v.stock,
          barcode: v.barcode ?? "",
          weight: v.weight ?? null,
          weightUnit: (v.weightUnit ?? null) as ProductFormData["weightUnit"],
          mediaKeys,
          options: dedupedOptions,
        };
      }),
      attributes: buildAttributeEntries(product.attributeValues ?? []),
      version: product.version,
    };
  }, [product]);

  const form = useForm<ProductFormData, unknown, ProductFormData>({
    resolver: zodResolver(schema) as unknown as Resolver<ProductFormData, unknown, ProductFormData>,
    defaultValues: derivedValues,
    // In update mode, re-sync the form when the underlying product changes
    // (e.g., user navigates away and returns - Next.js can preserve the React
    // tree and form state in memory, so without this the unsaved edits would
    // persist). keepDirtyValues lets the on-mount router.refresh() pull the
    // fresh server `version` (and any other untouched fields) into the form
    // without clobbering fields the user has already started editing.
    values: mode === "update" ? derivedValues : undefined,
    resetOptions: { keepDirtyValues: true },
  });

  const {
    fields: optionFields,
    append: appendOption,
    remove: removeOption,
  } = useFieldArray({ control: form.control, name: "options" });

  const {
    fields: variantFields,
    append: appendVariant,
    remove: removeVariant,
    replace: replaceVariants,
  } = useFieldArray({ control: form.control, name: "variants" });

  const watchedOptions = useWatch({ control: form.control, name: "options" });
  const watchedVariants = useWatch({ control: form.control, name: "variants" });
  const watchedTitle = useWatch({ control: form.control, name: "title" });
  const watchedRequiresShipping = useWatch({ control: form.control, name: "requiresShipping" });
  const watchedIsDigital = useWatch({ control: form.control, name: "isDigital" });

  // Auto-generate slug from title when not manually edited
  const prevTitleRef = useRef(form.getValues("title"));
  useEffect(() => {
    if (slugManuallyEdited) return;
    if (watchedTitle === prevTitleRef.current) return;
    prevTitleRef.current = watchedTitle;
    form.setValue("slug", slugify(watchedTitle), { shouldDirty: false });
  }, [watchedTitle, slugManuallyEdited, form]);

  useEffect(() => {
    if (mode !== "update" || !product) return;

    const productId = product.id;
    const variantIds = product.variants.map((v) => v.id);
    let cancelled = false;

    axios.get<{ stock: number | null; variants: { id: string; stock: number }[] }>(
        `/api/admin/products/${productId}/stock`
      )
      .then(({ data }) => {
        if (cancelled) return;
          form.setValue("stock", data.stock, { shouldDirty: false });
          const freshMap = new Map(data.variants.map((v) => [v.id, v.stock]));
          variantIds.forEach((variantId, index) => {
            const fresh = freshMap.get(variantId);
            if (fresh !== undefined) {
              form.setValue(`variants.${index}.stock`, fresh, { shouldDirty: false });
            }
          });
        },
      )
      .catch(() => {});

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

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
    setUploadedMedia(
      product.media.map((m) => ({
        key: m.key,
        url: m.url,
        mediaType: m.mediaType,
        mimeType: m.mimeType ?? undefined,
        thumbKey: m.thumbKey ?? undefined,
        posterUrl: m.thumbUrl ?? undefined,
        durationMs: m.durationMs ?? undefined,
        width: m.width ?? undefined,
        height: m.height ?? undefined,
      })),
    );
    setOptionValueInputs(product.options.map(() => ""));
    setSyncedOptionsSnapshot(
      snapshotOptions(
        product.options.map((opt) => ({
          name:
            opt.translations.find((tr) => tr.locale === DEFAULT_LOCALE)?.name ?? "",
          values: Array.from(new Set(opt.values.map((v) => v.value))),
        })),
      ),
    );
  }, [product]);

  const optionsChanged = !optionsAreSynced(watchedOptions, syncedOptionsSnapshot);

  const handleAddOptionValue = (optionIndex: number) => {
    const input = optionValueInputs[optionIndex]?.trim();
    if (!input) return;
    const current = form.getValues(`options.${optionIndex}.values`) ?? [];
    if (current.includes(input)) { toast.error(t("valueExists")); return; }
    form.setValue(`options.${optionIndex}.values`, [...current, input], { shouldValidate: true });
    setOptionValueInputs((prev) => { const next = [...prev]; next[optionIndex] = ""; return next; });
  };

  const handleRemoveOptionValue = (optionIndex: number, value: string) => {
    const current = form.getValues(`options.${optionIndex}.values`) ?? [];
    form.setValue(
      `options.${optionIndex}.values`,
      current.filter((v) => v !== value),
      { shouldValidate: true },
    );
    // Also drop the per-locale value translation, if any.
    for (const loc of NON_DEFAULT_LOCALES) {
      const path = `options.${optionIndex}.translations.${loc}.values` as const;
      const localizedValues = form.getValues(path);
      if (localizedValues && value in localizedValues) {
        const next = { ...localizedValues };
        delete next[value];
        form.setValue(path, next, { shouldValidate: false });
      }
    }
  };

  const handleOptionValueKeyDown = (e: KeyboardEvent<HTMLInputElement>, optionIndex: number) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddOptionValue(optionIndex);
    }
  };

  const handleGenerateVariants = () => {
    const options = form.getValues("options");
    const combinations = cartesianProduct(options);
    if (combinations.length === 0) {
      // No options to expand. If the snapshot also has nothing, the user
      // hasn't added options yet - nudge them. Otherwise the user just
      // removed every option, so clear the now-orphaned generated variants.
      if (syncedOptionsSnapshot.length === 0) {
        toast.error(t("addOptionFirst"));
        return;
      }
      replaceVariants([]);
      setSyncedOptionsSnapshot([]);
      toast.success(t("generated", { count: 0 }));
      return;
    }
    const previousVariants = form.getValues("variants") ?? [];
    const signatureOf = (opts: { name: string; value: string }[]) =>
      [...opts].map((o) => `${o.name}\u0000${o.value}`).sort().join("\u0001");
    const previousBySignature = new Map(
      previousVariants.map((v) => [signatureOf(v.options), v]),
    );
    const usedSkus = new Set<string>();
    const makeSku = (combo: { name: string; value: string }[]) => {
      const base =
        combo.map((o) => o.value.toUpperCase().replace(/[^A-Z0-9]+/g, "")).filter((s) => s.length > 0).join("-") || "VARIANT";
      let sku = base;
      let n = 2;
      while (usedSkus.has(sku)) { sku = `${base}-${n++}`; }
      usedSkus.add(sku);
      return sku;
    };
    replaceVariants(
      combinations.map((combo) => {
        const sku = makeSku(combo);
        const previous = previousBySignature.get(signatureOf(combo));
        return {
          sku,
          price: previous?.price ?? form.getValues("price"),
          compareAtPrice: previous?.compareAtPrice ?? null,
          costPrice: previous?.costPrice ?? null,
          stock: previous?.stock ?? 0,
          barcode: previous?.barcode ?? "",
          weight: previous?.weight ?? null,
          weightUnit: previous?.weightUnit ?? null,
          mediaKeys: previous?.mediaKeys ?? [],
          options: combo,
        };
      }),
    );
    setSyncedOptionsSnapshot(snapshotOptions(options));
    toast.success(t("generated", { count: combinations.length }));
  };

  // Mirror uploadedMedia into the form value + prune any variant→media
  // references that point at removed keys. Driven by an effect so the upload
  // component can stay controlled (parent owns the state, which is what keeps
  // the media alive across tab unmounts).
  useEffect(() => {
    form.setValue(
      "media",
      uploadedMedia.map((m) => ({
        key: m.key,
        mediaType: m.mediaType,
        thumbKey: m.thumbKey,
        mimeType: m.mimeType,
        durationMs: m.durationMs,
        width: m.width,
        height: m.height,
      })),
    );
    const validKeys = new Set(uploadedMedia.map((m) => m.key));
    const currentVariants = form.getValues("variants") ?? [];
    currentVariants.forEach((variant, index) => {
      const current = variant.mediaKeys ?? [];
      const filtered = current.filter((k) => validKeys.has(k));
      if (filtered.length !== current.length) {
        form.setValue(`variants.${index}.mediaKeys`, filtered, {
          shouldDirty: true,
        });
      }
    });
  }, [uploadedMedia, form]);

  // Tab error indicators
  const errors = form.formState.errors;
  const detailsHasError = !!(errors.title || errors.slug || errors.description || errors.shortDescription);
  const pricingHasError = !!(errors.price || errors.compareAtPrice || errors.costPrice || errors.stock || errors.barcode || errors.taxCode);
  const shippingHasError = !!(errors.weight || errors.length || errors.width || errors.height);
  const seoHasError = !!(errors.metaTitle || errors.metaDescription);
  const variantsHasError = !!(errors.options || errors.variants);

  const onSubmit = (data: ProductFormData) => {
    startTransition(async () => {
      let result;

      const translationsPayload = buildProductTranslationsPayload(data.translations);
      const optionsPayload = data.options.map((opt) => ({
        ...opt,
        translations: buildOptionTranslationsPayload(opt.translations),
      }));

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
          media: data.media,
          options: optionsPayload,
          variants: data.variants,
          attributes: data.attributes,
        };
        result = await createProduct(createData, redirectTo);
      } else {
        const updateData: UpdateProductInput = {
          ...(data as UpdateProductInput),
          translations: translationsPayload,
          options: optionsPayload,
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
    if (formErrors.options || formErrors.variants) tabs.push(t("tabOptions"));

    const messages = collectErrorMessages(formErrors);
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

  function TabLabel({ label, hasError }: { label: string; hasError: boolean }) {
    return (
      <span className="flex items-center gap-1.5">
        {label}
        {hasError && <AlertCircle className="w-3 h-3 text-destructive" />}
      </span>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onSubmitInvalid)} className="flex-1 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 shrink-0">
            <TabsTrigger value="details">
              <TabLabel label={t("tabDetails")} hasError={detailsHasError} />
            </TabsTrigger>
            <TabsTrigger value="pricing">
              <TabLabel label={t("tabPricing")} hasError={pricingHasError} />
            </TabsTrigger>
            <TabsTrigger value="shipping">
              <TabLabel label={t("tabShipping")} hasError={shippingHasError} />
            </TabsTrigger>
            <TabsTrigger value="seo">
              <TabLabel label={t("tabSeo")} hasError={seoHasError} />
            </TabsTrigger>
            <TabsTrigger value="variants">
              <TabLabel label={t("tabOptions")} hasError={variantsHasError} />
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
                    <FormLabel>{t("titleField")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("titlePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shortDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("shortDesc")}
                      <span className="ml-1.5 font-normal text-muted-foreground">- {t("optional")}</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={t("shortDescPlaceholder")} {...field} />
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
                        className="min-h-30"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Translation sections - one per non-default locale */}
            {NON_DEFAULT_LOCALES.map((loc) => (
              <PerLocaleProductSection
                key={loc}
                locale={loc}
                form={form}
                fallbackTitle={form.watch("title") ?? ""}
                fallbackShortDescription={form.watch("shortDescription") ?? ""}
                fallbackDescription={form.watch("description") ?? ""}
                excludeId={product?.id}
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
                        placeholder={t("slugPlaceholder")}
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
                          form.setValue("slug", slugify(form.getValues("title")));
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
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {categoryTree.length > 0 && (
              <FormField
                control={form.control}
                name="categoryIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("categories")}
                      <span className="ml-1.5 font-normal text-muted-foreground">- {t("optional")}</span>
                    </FormLabel>
                    <FormControl>
                      <CategoryPicker
                        tree={categoryTree}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
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
                    <FormLabel>
                      {t("brand")}
                      <span className="ml-1.5 font-normal text-muted-foreground">- {t("optional")}</span>
                    </FormLabel>
                    <FormControl>
                      <BrandSelect
                        brands={brands}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
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
                    <FormLabel>{t("price")}</FormLabel>
                    <FormControl>
                      <PriceInput value={field.value} onChange={field.onChange} rates={rates} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="compareAtPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("compareAtPrice")}
                      <span className="ml-1.5 font-normal text-muted-foreground">- {t("optional")}</span>
                    </FormLabel>
                    <FormControl>
                      <PriceInput value={field.value ?? 0} onChange={(v) => field.onChange(v || null)} rates={rates} />
                    </FormControl>
                    <FormDescription>{t("compareAtDesc")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="costPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("costPrice")}
                      <span className="ml-1.5 font-normal text-muted-foreground">- {t("optional")}</span>
                    </FormLabel>
                    <FormControl>
                      <PriceInput value={field.value ?? 0} onChange={(v) => field.onChange(v || null)} rates={rates} />
                    </FormControl>
                    <FormDescription>{t("costDesc")}</FormDescription>
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
                      <Input
                        type="number"
                        placeholder={t("unlimited")}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : parseInt(e.target.value, 10))
                        }
                      />
                    </FormControl>
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
                  <FormLabel>
                    {t("barcode")}
                    <span className="ml-1.5 font-normal text-muted-foreground">- {t("optional")}</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder={t("barcodePlaceholder")} {...field} />
                  </FormControl>
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
                  <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-background dark:bg-input/30">
                    <div>
                      <FormLabel className="text-base">{t("chargeTaxes")}</FormLabel>
                      <FormDescription>
                        {t("chargeTaxesDesc")}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("taxCode")}
                      <span className="ml-1.5 font-normal text-muted-foreground">- {t("optional")}</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder={t("taxCodePlaceholder")} {...field} />
                    </FormControl>
                    <FormDescription>
                      {t("taxCodeDesc")}
                    </FormDescription>
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
                  <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-background dark:bg-input/30">
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
                  </FormItem>
                )}
              />

              {!watchedIsDigital && (
                <FormField
                  control={form.control}
                  name="requiresShipping"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-background dark:bg-input/30">
                      <div>
                        <FormLabel className="text-base">{t("requiresShipping")}</FormLabel>
                        <FormDescription>
                          {t("requiresShippingDesc")}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
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
                    <FormLabel>
                      {t("metaTitle")}
                      <span className="ml-1.5 font-normal text-muted-foreground">- {t("optional")}</span>
                    </FormLabel>
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="metaDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("metaDescription")}
                      <span className="ml-1.5 font-normal text-muted-foreground">- {t("optional")}</span>
                    </FormLabel>
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

          {/* ── OPTIONS & VARIANTS TAB ── */}
          <TabsContent value="variants" className="space-y-6 pt-4 overflow-y-auto min-h-0 pb-6">
            {/* Options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold">{t("options")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("optionsDesc")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    appendOption({ name: "", values: [], translations: emptyOptionTranslations() });
                    setOptionValueInputs((prev) => [...prev, ""]);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t("addOption")}
                </Button>
              </div>

              {optionFields.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
                  {t("noOptions")}
                </p>
              )}

              {optionFields.map((optionField, optionIndex) => {
                const values = watchedOptions?.[optionIndex]?.values ?? [];
                const uniqueValues = Array.from(new Set(values));
                return (
                  <div key={optionField.id} className="border rounded-md p-4 space-y-4 bg-background dark:bg-input/30">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{t("option")} {optionIndex + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          removeOption(optionIndex);
                          setOptionValueInputs((prev) => prev.filter((_, i) => i !== optionIndex));
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* English (default) */}
                    <div className="rounded-md border border-border/60 p-3 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {LOCALE_LABELS[DEFAULT_LOCALE].emoji} {LOCALE_LABELS[DEFAULT_LOCALE].label}
                      </p>

                      <FormField
                        control={form.control}
                        name={`options.${optionIndex}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{t("optionName")}</FormLabel>
                            <FormControl>
                              <Input placeholder={t("optionNamePlaceholder")} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="space-y-2">
                        <FormLabel className="text-xs text-muted-foreground">
                          {t("valuesHint")}
                        </FormLabel>
                        {uniqueValues.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {uniqueValues.map((value: string) => (
                              <Badge
                                key={value}
                                variant="secondary"
                                className="gap-1 cursor-pointer"
                                onClick={() => handleRemoveOptionValue(optionIndex, value)}
                              >
                                {value}
                                <X className="w-3 h-3" />
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Input
                            placeholder={t("addValuePlaceholder")}
                            value={optionValueInputs[optionIndex] ?? ""}
                            onChange={(e) =>
                              setOptionValueInputs((prev) => {
                                const next = [...prev];
                                next[optionIndex] = e.target.value;
                                return next;
                              })
                            }
                            onKeyDown={(e) => handleOptionValueKeyDown(e, optionIndex)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddOptionValue(optionIndex)}
                          >
                            {t("addValue")}
                          </Button>
                        </div>
                        {form.formState.errors.options?.[optionIndex]?.values && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.options[optionIndex]?.values?.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Translation sections - one per non-default locale */}
                    {NON_DEFAULT_LOCALES.map((loc) => (
                      <div key={loc} className="rounded-md border border-border/60 p-3 space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                          {LOCALE_LABELS[loc].emoji} {LOCALE_LABELS[loc].label}
                        </p>

                        <FormField
                          control={form.control}
                          name={`options.${optionIndex}.translations.${loc}.name` as const}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">{t("optionName")}</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={watchedOptions?.[optionIndex]?.name || t("optionNamePlaceholder")}
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {uniqueValues.length > 0 && (
                          <div className="space-y-2">
                            <FormLabel className="text-xs text-muted-foreground">
                              {t("valueTranslations")}
                            </FormLabel>
                            <div className="space-y-1.5">
                              {uniqueValues.map((value: string) => (
                                <FormField
                                  key={value}
                                  control={form.control}
                                  name={`options.${optionIndex}.translations.${loc}.values.${value}` as `options.${number}.translations.${typeof loc}.values.${string}`}
                                  render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 space-y-0">
                                      <span className="text-xs text-muted-foreground w-24 shrink-0 truncate">
                                        {value}
                                      </span>
                                      <FormControl>
                                        <Input
                                          placeholder={value}
                                          className="h-8 text-sm"
                                          {...field}
                                          value={(field.value as string | undefined) ?? ""}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            <Separator />

            {/* Variants */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold">{t("variants")}</h3>
                  <p className="text-sm text-muted-foreground">{t("variantsDesc")}</p>
                </div>
                <div className="flex gap-2">
                  {(optionFields.length > 0 || optionsChanged) && (
                    <Button
                      type="button"
                      variant={optionsChanged ? "default" : "outline"}
                      size="sm"
                      onClick={handleGenerateVariants}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      {t("generateVariants")}
                      {optionsChanged && ` ${t("required")}`}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendVariant({
                        sku: "",
                        price: form.getValues("price"),
                        compareAtPrice: null,
                        costPrice: null,
                        stock: 0,
                        barcode: "",
                        weight: null,
                        weightUnit: null,
                        mediaKeys: [],
                        options: [],
                      })
                    }
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {t("addManually")}
                  </Button>
                </div>
              </div>

              {mode === "update" && optionsChanged && (
                <Alert className="border-orange-200 bg-orange-50">
                  <RefreshCw className="h-4 w-4 text-orange-600" />
                  <AlertTitle className="text-orange-800">{t("optionsChanged")}</AlertTitle>
                  <AlertDescription className="text-orange-700">
                    {t("regenerateHint")}
                  </AlertDescription>
                </Alert>
              )}

              {variantFields.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
                  {t("noVariants")}
                </p>
              )}

              {variantFields.map((variantField, variantIndex) => {
                const variantOptions = watchedVariants?.[variantIndex]?.options ?? [];
                const selectedMediaKeys = watchedVariants?.[variantIndex]?.mediaKeys ?? [];

                return (
                  <div key={variantField.id} className="border rounded-md p-4 space-y-3 bg-background dark:bg-input/30">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {variantOptions.length > 0 ? (
                          variantOptions.map((opt: { name: string; value: string }, optIdx: number) => (
                            <Badge key={`${optIdx}-${opt.name}`} variant="outline">
                              {opt.name}: {opt.value}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">{t("manualVariant")}</span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariant(variantIndex)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Basic variant fields */}
                    <div className="grid grid-cols-3 gap-3">
                      <FormField
                        control={form.control}
                        name={`variants.${variantIndex}.sku`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{t("sku")}</FormLabel>
                            <FormControl>
                              <Input placeholder={t("skuPlaceholder")} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`variants.${variantIndex}.price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{t("price")}</FormLabel>
                            <FormControl>
                              <PriceInput value={field.value} onChange={field.onChange} rates={rates} inputClassName="text-sm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`variants.${variantIndex}.stock`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{t("stock")}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0"
                                value={field.value}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Extended variant fields */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <FormField
                        control={form.control}
                        name={`variants.${variantIndex}.compareAtPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{t("compareAt")}</FormLabel>
                            <FormControl>
                              <PriceInput value={field.value ?? 0} onChange={(v) => field.onChange(v || null)} rates={rates} inputClassName="text-sm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`variants.${variantIndex}.costPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{t("cost")}</FormLabel>
                            <FormControl>
                              <PriceInput value={field.value ?? 0} onChange={(v) => field.onChange(v || null)} rates={rates} inputClassName="text-sm" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`variants.${variantIndex}.barcode`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{t("barcodeShort")}</FormLabel>
                            <FormControl>
                              <Input placeholder="-" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex gap-1.5">
                        <FormField
                          control={form.control}
                          name={`variants.${variantIndex}.weight`}
                          render={({ field }) => (
                            <FormItem className="flex-1 min-w-0">
                              <FormLabel className="text-xs">{t("weight")}</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="-"
                                  value={field.value ?? ""}
                                  onChange={(e) =>
                                    field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))
                                  }
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`variants.${variantIndex}.weightUnit`}
                          render={({ field }) => (
                            <FormItem className="w-16 shrink-0">
                              <FormLabel className="text-xs">{t("unit")}</FormLabel>
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
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Variant media */}
                    <div className="space-y-2">
                      <FormLabel className="text-xs text-muted-foreground">
                        {t("variantMedia")}
                      </FormLabel>
                      {uploadedMedia.length === 0 ? (
                        <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                          <ImageOff className="w-3.5 h-3.5" />
                          {t("uploadFirst")}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {uploadedMedia.map((m) => {
                            const isSelected = selectedMediaKeys.includes(m.key);
                            const isVideo = m.mediaType === "VIDEO";
                            const thumbSrc = isVideo ? (m.posterUrl ?? m.url) : m.url;
                            return (
                              <button
                                type="button"
                                key={m.key}
                                onClick={() => {
                                  const next = isSelected
                                    ? selectedMediaKeys.filter((k) => k !== m.key)
                                    : [...selectedMediaKeys, m.key];
                                  form.setValue(`variants.${variantIndex}.mediaKeys`, next, { shouldDirty: true });
                                }}
                                className={cn(
                                  "relative w-16 h-16 rounded border-2 overflow-hidden shrink-0 transition-all cursor-pointer",
                                  isSelected
                                    ? "border-primary opacity-100 ring-2 ring-primary/30"
                                    : "border-transparent opacity-60 hover:opacity-100",
                                )}
                              >
                                {isVideo && !m.posterUrl ? (
                                  <video src={thumbSrc} className="absolute inset-0 w-full h-full object-cover" muted playsInline preload="metadata" />
                                ) : (
                                  <Image src={thumbSrc} alt="Variant media" fill sizes="64px" className="object-cover" unoptimized={thumbSrc.startsWith("blob:")} />
                                )}
                                {isVideo && (
                                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                                    <span className="text-white text-[10px] font-semibold">VIDEO</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        <div className="shrink-0 pt-4 pb-6 border-t">
          <Button type="submit" disabled={isPending}>
            {isPending
              ? t("saving")
              : mode === "create"
                ? t("create")
                : t("update")}
          </Button>
        </div>
      </form>
    </Form>
  );
}