"use client";
import axios from "axios";

import { useEffect, useMemo, useRef, useState, useTransition, KeyboardEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useForm, useFieldArray, useWatch, Resolver, FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { ProductImageUpload } from "@/components/product/ProductImageUpload";
import {
  createProductSchema,
  updateProductSchema,
  CreateProductInput,
  UpdateProductInput,
} from "../schema/products";
import { createProduct, updateProduct } from "../actions/products";
import {
  SerializedProductWithRelations,
  PresignedUploadedImage,
} from "@/types/types";
import { X, Plus, RefreshCw, ImageOff, AlertCircle } from "lucide-react";
import Image from "next/image";
import { cn, slugify } from "@/lib/utils";
import { BrandSelect, type BrandOption } from "@/features/brands/components/BrandSelect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { getCategoryName } from "@/features/categories/utils/translations";
import type { CategoryTreeItem } from "@/features/categories/db/categories";
import { useCurrencyStore } from "@/store/currency";
import { CURRENCIES } from "@/lib/currency";
import type { Currency } from "@/lib/currency-config";

/**
 * Price input with inline currency selector.
 * The form field always stores USD decimal (e.g. 18.43).
 * Seller can switch to any supported currency and type in that currency —
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
            <SelectValue />
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

type OptionTranslationsForm = {
  sr?: { name?: string; values?: Record<string, string> };
} | null;

/**
 * Always returns the full translation shape with `sr.values` as a record.
 * Pre-initializing the object prevents RHF's `setValue` from creating an
 * array when a value key looks numeric (e.g. size "10").
 */
function normalizeOptionTranslations(
  raw: unknown,
): NonNullable<OptionTranslationsForm> {
  const empty = { sr: { name: "", values: {} as Record<string, string> } };
  if (!raw || typeof raw !== "object") return empty;
  const srRaw = (raw as { sr?: unknown }).sr;
  if (!srRaw || typeof srRaw !== "object") return empty;
  const sr = srRaw as { name?: unknown; values?: unknown };
  const values: Record<string, string> = {};
  if (Array.isArray(sr.values)) {
    sr.values.forEach((v, i) => {
      if (typeof v === "string") values[String(i)] = v;
    });
  } else if (sr.values && typeof sr.values === "object") {
    for (const [k, v] of Object.entries(sr.values as Record<string, unknown>)) {
      if (typeof v === "string") values[k] = v;
    }
  }
  return {
    sr: {
      name: typeof sr.name === "string" ? sr.name : "",
      values,
    },
  };
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
  brandId: string | undefined;
  categoryIds: string[];
  images: { key: string }[];
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
    imageKeys: string[];
    options: { name: string; value: string }[];
  }[];
  version: number;
};

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
  onSuccess?: () => void;
  redirectTo?: string;
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

export function ProductForm({
  mode,
  product,
  brands = [],
  categoryTree = [],
  onSuccess,
  redirectTo,
}: ProductFormProps) {
  const t = useTranslations("productForm");
  const { rates } = useCurrencyStore();
  const [isPending, startTransition] = useTransition();
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const [uploadedImages, setUploadedImages] = useState<PresignedUploadedImage[]>(
    product?.images.map((img) => ({ key: img.key, url: img.url })) ?? [],
  );

  const [optionValueInputs, setOptionValueInputs] = useState<string[]>(
    () => product?.options.map(() => "") ?? [],
  );

  const [syncedOptionsSnapshot, setSyncedOptionsSnapshot] = useState<OptionSnapshot[]>(
    () =>
      snapshotOptions(
        product?.options.map((opt) => ({
          name: opt.name,
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
        brandId: undefined,
        categoryIds: [],
        images: [],
        options: [],
        variants: [],
        version: 1,
      };
    }
    const optionById = new Map(product.options.map((o) => [o.id, o.name]));
    const imageKeyById = new Map(product.images.map((img) => [img.id, img.key]));
    return {
      title: product.title,
      slug: product.slug ?? "",
      description: product.description,
      shortDescription: product.shortDescription ?? "",
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
      metaTitle: product.metaTitle ?? "",
      metaDescription: product.metaDescription ?? "",
      brandId: product.brandId ?? undefined,
      categoryIds: product.categories.map((c) => c.categoryId),
      images: product.images.map((img) => ({ key: img.key })),
      options: product.options.map((opt) => ({
        name: opt.name,
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
        const imageKeys = v.images
          .map((vi) => imageKeyById.get(vi.imageId))
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
          imageKeys,
          options: dedupedOptions,
        };
      }),
      version: product.version,
    };
  }, [product]);

  const form = useForm<ProductFormData, unknown, ProductFormData>({
    resolver: zodResolver(schema) as unknown as Resolver<ProductFormData, unknown, ProductFormData>,
    defaultValues: derivedValues,
    // In update mode, re-sync the form when the underlying product changes
    // (e.g., user navigates away and returns — Next.js can preserve the React
    // tree and form state in memory, so without this the unsaved edits would
    // persist).
    values: mode === "update" ? derivedValues : undefined,
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

  // Re-sync local UI state (not in RHF) when the product reference changes —
  // happens on navigation back to the edit page. Skips the initial mount to
  // avoid redundant state writes.
  const productRef = useRef(product);
  useEffect(() => {
    if (productRef.current === product) return;
    productRef.current = product;
    if (!product) return;
    setSlugManuallyEdited(false);
    prevTitleRef.current = product.title;
    setUploadedImages(product.images.map((img) => ({ key: img.key, url: img.url })));
    setOptionValueInputs(product.options.map(() => ""));
    setSyncedOptionsSnapshot(
      snapshotOptions(
        product.options.map((opt) => ({
          name: opt.name,
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
    const srValues = form.getValues(`options.${optionIndex}.translations.sr.values`);
    if (srValues && value in srValues) {
      const next = { ...srValues };
      delete next[value];
      form.setValue(`options.${optionIndex}.translations.sr.values`, next, { shouldValidate: false });
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
      toast.error(t("addOptionFirst"));
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
          imageKeys: previous?.imageKeys ?? [],
          options: combo,
        };
      }),
    );
    setSyncedOptionsSnapshot(snapshotOptions(options));
    toast.success(t("generated", { count: combinations.length }));
  };

  const handleImageUpload = (images: PresignedUploadedImage[]) => {
    setUploadedImages(images);
    form.setValue("images", images.map((img) => ({ key: img.key })));
    const validKeys = new Set(images.map((img) => img.key));
    const currentVariants = form.getValues("variants") ?? [];
    currentVariants.forEach((variant, index) => {
      const current = variant.imageKeys ?? [];
      const filtered = current.filter((k) => validKeys.has(k));
      if (filtered.length !== current.length) {
        form.setValue(`variants.${index}.imageKeys`, filtered, { shouldDirty: true });
      }
    });
  };

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
          brandId: data.brandId || undefined,
          categoryIds: data.categoryIds,
          images: data.images,
          options: data.options,
          variants: data.variants,
        };
        result = await createProduct(createData, redirectTo);
      } else {
        result = await updateProduct(
          product!.id,
          data as UpdateProductInput,
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
        <Tabs defaultValue="details" className="flex-1 min-h-0">
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
                  <FormDescription>
                    {t("slugDesc")}
                  </FormDescription>
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
                    <span className="ml-1.5 font-normal text-muted-foreground">— {t("optional")}</span>
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

            {categoryTree.length > 0 && (
              <FormField
                control={form.control}
                name="categoryIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("categories")}
                      <span className="ml-1.5 font-normal text-muted-foreground">— {t("optional")}</span>
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

            {brands.length > 0 && (
              <FormField
                control={form.control}
                name="brandId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("brand")}
                      <span className="ml-1.5 font-normal text-muted-foreground">— {t("optional")}</span>
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
              <FormLabel className="text-base font-semibold">{t("images")}</FormLabel>
              <ProductImageUpload
                onUploadComplete={handleImageUpload}
                initialImages={uploadedImages}
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
                      <span className="ml-1.5 font-normal text-muted-foreground">— {t("optional")}</span>
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
                      <span className="ml-1.5 font-normal text-muted-foreground">— {t("optional")}</span>
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

            {watchedVariants?.length === 0 && (
              <FormField
                control={form.control}
                name="stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("stock")}
                      <span className="ml-1.5 font-normal text-muted-foreground">— {t("unlimitedHint")}</span>
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
            )}

            <FormField
              control={form.control}
              name="barcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("barcode")}
                    <span className="ml-1.5 font-normal text-muted-foreground">— {t("optional")}</span>
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
                      <span className="ml-1.5 font-normal text-muted-foreground">— {t("optional")}</span>
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
                                <SelectValue placeholder="—" />
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
                                <SelectValue placeholder="—" />
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

            <FormField
              control={form.control}
              name="metaTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("metaTitle")}
                    <span className="ml-1.5 font-normal text-muted-foreground">— {t("optional")}</span>
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
                    <span className="ml-1.5 font-normal text-muted-foreground">— {t("optional")}</span>
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

            {/* Preview */}
            {(form.watch("metaTitle") || form.watch("title")) && (
              <div className="rounded-lg border p-4 space-y-1 bg-background dark:bg-input/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("searchPreview")}</p>
                <p className="text-base text-blue-600 font-medium truncate">
                  {form.watch("metaTitle") || form.watch("title")}
                </p>
                <p className="text-xs text-green-700">
                  example.com/products/{form.watch("slug") || "product-slug"}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {form.watch("metaDescription") || form.watch("shortDescription") || form.watch("description") || t("noDescription")}
                </p>
              </div>
            )}
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
                    appendOption({ name: "", values: [], translations: { sr: { name: "", values: {} } } });
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
                        🇬🇧 {t("langEn")}
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

                    {/* Serbian translation */}
                    <div className="rounded-md border border-border/60 p-3 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        🇷🇸 {t("langSr")}
                      </p>

                      <FormField
                        control={form.control}
                        name={`options.${optionIndex}.translations.sr.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">{t("optionName")}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t("optionNameSrPlaceholder")}
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
                                name={`options.${optionIndex}.translations.sr.values.${value}` as `options.${number}.translations.sr.values.${string}`}
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
                  {optionFields.length > 0 && (
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
                        imageKeys: [],
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
                const selectedImageKeys = watchedVariants?.[variantIndex]?.imageKeys ?? [];

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
                              <Input placeholder="—" {...field} />
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
                                  placeholder="—"
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
                                    <SelectValue placeholder="—" />
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

                    {/* Variant images */}
                    <div className="space-y-2">
                      <FormLabel className="text-xs text-muted-foreground">
                        {t("variantImages")}
                      </FormLabel>
                      {uploadedImages.length === 0 ? (
                        <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                          <ImageOff className="w-3.5 h-3.5" />
                          {t("uploadFirst")}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {uploadedImages.map((img) => {
                            const isSelected = selectedImageKeys.includes(img.key);
                            return (
                              <button
                                type="button"
                                key={img.key}
                                onClick={() => {
                                  const next = isSelected
                                    ? selectedImageKeys.filter((k) => k !== img.key)
                                    : [...selectedImageKeys, img.key];
                                  form.setValue(`variants.${variantIndex}.imageKeys`, next, { shouldDirty: true });
                                }}
                                className={cn(
                                  "relative w-16 h-16 rounded border-2 overflow-hidden shrink-0 transition-all cursor-pointer",
                                  isSelected
                                    ? "border-primary opacity-100 ring-2 ring-primary/30"
                                    : "border-transparent opacity-60 hover:opacity-100",
                                )}
                              >
                                <Image src={img.url} alt="Variant image" fill className="object-cover" />
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