"use client";

import { useEffect, useRef, useState, useTransition, KeyboardEvent } from "react";
import { useForm, useFieldArray, useWatch, Resolver } from "react-hook-form";
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
  images: { key: string }[];
  options: { name: string; values: string[] }[];
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
  current: { name: string; values: string[] }[] | undefined,
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

function cartesianProduct(
  options: { name: string; values: string[] }[],
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
  onSuccess?: () => void;
  redirectTo?: string;
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
  onSuccess,
  redirectTo,
}: ProductFormProps) {
  const [isPending, startTransition] = useTransition();
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(
    mode === "update" && !!product?.slug,
  );

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

  const optionById = new Map(product?.options.map((o) => [o.id, o.name]) ?? []);
  const imageKeyById = new Map(
    product?.images.map((img) => [img.id, img.key]) ?? [],
  );

  const schema = mode === "create" ? createProductSchema : updateProductSchema;

  const form = useForm<ProductFormData, unknown, ProductFormData>({
    resolver: zodResolver(schema) as unknown as Resolver<ProductFormData, unknown, ProductFormData>,
    defaultValues: product
      ? {
          title: product.title,
          slug: product.slug ?? "",
          description: product.description,
          shortDescription: product.shortDescription ?? "",
          price: Number(product.price),
          compareAtPrice: product.compareAtPrice != null ? Number(product.compareAtPrice) : null,
          costPrice: product.costPrice != null ? Number(product.costPrice) : null,
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
          images: product.images.map((img) => ({ key: img.key })),
          options: product.options.map((opt) => ({
            name: opt.name,
            values: Array.from(new Set(opt.values.map((v) => v.value))),
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
              price: Number(v.price),
              compareAtPrice: v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
              costPrice: v.costPrice != null ? Number(v.costPrice) : null,
              stock: v.stock,
              barcode: v.barcode ?? "",
              weight: v.weight ?? null,
              weightUnit: (v.weightUnit ?? null) as ProductFormData["weightUnit"],
              imageKeys,
              options: dedupedOptions,
            };
          }),
          version: product.version,
        }
      : {
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
          images: [],
          options: [],
          variants: [],
          version: 1,
        },
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

    fetch(`/api/admin/products/${productId}/stock`)
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            stock: number | null;
            variants: { id: string; stock: number }[];
          } | null,
        ) => {
          if (cancelled || !data) return;
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

  const optionsChanged = !optionsAreSynced(watchedOptions, syncedOptionsSnapshot);

  const handleAddOptionValue = (optionIndex: number) => {
    const input = optionValueInputs[optionIndex]?.trim();
    if (!input) return;
    const current = form.getValues(`options.${optionIndex}.values`) ?? [];
    if (current.includes(input)) { toast.error("Value already exists"); return; }
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
      toast.error("Add at least one option with values to generate variants");
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
    toast.success(`Generated ${combinations.length} variant(s)`);
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
        toast.success(mode === "create" ? "Product created" : "Product updated");
        onSuccess?.();
      }
    });
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
        <Tabs defaultValue="details" className="flex-1 min-h-0">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 shrink-0">
            <TabsTrigger value="details">
              <TabLabel label="Details" hasError={detailsHasError} />
            </TabsTrigger>
            <TabsTrigger value="pricing">
              <TabLabel label="Pricing & Inventory" hasError={pricingHasError} />
            </TabsTrigger>
            <TabsTrigger value="shipping">
              <TabLabel label="Shipping" hasError={shippingHasError} />
            </TabsTrigger>
            <TabsTrigger value="seo">
              <TabLabel label="SEO" hasError={seoHasError} />
            </TabsTrigger>
            <TabsTrigger value="variants">
              <TabLabel label="Options & Variants" hasError={variantsHasError} />
            </TabsTrigger>
          </TabsList>

          {/* ── DETAILS TAB ── */}
          <TabsContent value="details" className="space-y-6 pt-4 overflow-y-auto min-h-0 pb-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Product title" {...field} />
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
                  <FormLabel>Slug</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        placeholder="product-url-slug"
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
                    Used in the product URL. Auto-generated from title.
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
                    Short Description
                    <span className="ml-1.5 font-normal text-muted-foreground">— optional</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="One-line summary for cards and search results" {...field} />
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Full product description"
                      className="min-h-30"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {brands.length > 0 && (
              <FormField
                control={form.control}
                name="brandId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Brand
                      <span className="ml-1.5 font-normal text-muted-foreground">— optional</span>
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
              <FormLabel className="text-base font-semibold">Images</FormLabel>
              <ProductImageUpload
                onUploadComplete={handleImageUpload}
                initialImages={uploadedImages}
              />
            </div>
          </TabsContent>

          {/* ── PRICING & INVENTORY TAB ── */}
          <TabsContent value="pricing" className="space-y-6 pt-4 overflow-y-auto min-h-0 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={field.value}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
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
                      Compare at Price
                      <span className="ml-1.5 font-normal text-muted-foreground">— optional</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormDescription>Original price shown as strikethrough.</FormDescription>
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
                      Cost Price
                      <span className="ml-1.5 font-normal text-muted-foreground">— optional</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? null : parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormDescription>Your cost. Used for margin reports.</FormDescription>
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
                      Stock
                      <span className="ml-1.5 font-normal text-muted-foreground">— leave blank for unlimited</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Unlimited"
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
                    Barcode (ISBN, UPC, GTIN)
                    <span className="ml-1.5 font-normal text-muted-foreground">— optional</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 978-3-16-148410-0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Tax</h3>

              <FormField
                control={form.control}
                name="taxable"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <FormLabel className="text-base">Charge taxes</FormLabel>
                      <FormDescription>
                        Enable to apply taxes at checkout.
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
                      Tax Code
                      <span className="ml-1.5 font-normal text-muted-foreground">— optional</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. P0000000" {...field} />
                    </FormControl>
                    <FormDescription>
                      Tax category code for your tax provider.
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
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <FormLabel className="text-base">Digital product</FormLabel>
                      <FormDescription>
                        No physical shipping required (e.g. software, ebooks).
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
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <FormLabel className="text-base">Requires shipping</FormLabel>
                        <FormDescription>
                          Uncheck for virtual goods that still have a physical component.
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
                  <h3 className="text-sm font-semibold">Weight</h3>
                  <div className="flex gap-3">
                    <FormField
                      control={form.control}
                      name="weight"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Weight</FormLabel>
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
                          <FormLabel>Unit</FormLabel>
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
                  <h3 className="text-sm font-semibold">Dimensions</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(["length", "width", "height"] as const).map((dim) => (
                      <FormField
                        key={dim}
                        control={form.control}
                        name={dim}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="capitalize">{dim}</FormLabel>
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
                          <FormLabel>Unit</FormLabel>
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
              These fields control how the product appears in search engine results.
              Leave blank to use the product title and description automatically.
            </p>

            <FormField
              control={form.control}
              name="metaTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Meta Title
                    <span className="ml-1.5 font-normal text-muted-foreground">— optional</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={form.watch("title") || "Page title for search engines"}
                      maxLength={70}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value?.length ?? 0}/70 characters recommended
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
                    Meta Description
                    <span className="ml-1.5 font-normal text-muted-foreground">— optional</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description for search engine results"
                      maxLength={160}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value?.length ?? 0}/160 characters recommended
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preview */}
            {(form.watch("metaTitle") || form.watch("title")) && (
              <div className="rounded-lg border p-4 space-y-1 bg-muted/30">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Search preview</p>
                <p className="text-base text-blue-600 font-medium truncate">
                  {form.watch("metaTitle") || form.watch("title")}
                </p>
                <p className="text-xs text-green-700">
                  example.com/products/{form.watch("slug") || "product-slug"}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {form.watch("metaDescription") || form.watch("shortDescription") || form.watch("description") || "No description provided."}
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
                  <h3 className="text-base font-semibold">Options</h3>
                  <p className="text-sm text-muted-foreground">
                    Add options like Color or Size, then generate variants below.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    appendOption({ name: "", values: [] });
                    setOptionValueInputs((prev) => [...prev, ""]);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Option
                </Button>
              </div>

              {optionFields.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
                  No options added. Click &quot;Add Option&quot; to add product options like Color or Size.
                </p>
              )}

              {optionFields.map((optionField, optionIndex) => {
                const values = watchedOptions?.[optionIndex]?.values ?? [];
                return (
                  <div key={optionField.id} className="border rounded-md p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <FormField
                        control={form.control}
                        name={`options.${optionIndex}.name`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input placeholder="Option name (e.g. Color)" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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

                    <div className="space-y-2">
                      <FormLabel className="text-xs text-muted-foreground">
                        Values — press Enter or comma to add
                      </FormLabel>
                      {values.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {Array.from(new Set(values)).map((value: string) => (
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
                          placeholder="Add value..."
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
                          Add
                        </Button>
                      </div>
                      {form.formState.errors.options?.[optionIndex]?.values && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.options[optionIndex]?.values?.message}
                        </p>
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
                  <h3 className="text-base font-semibold">Variants</h3>
                  <p className="text-sm text-muted-foreground">Each variant has its own SKU, price and stock.</p>
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
                      Generate from Options
                      {optionsChanged && " (required)"}
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
                    Add Manually
                  </Button>
                </div>
              </div>

              {mode === "update" && optionsChanged && (
                <Alert className="border-orange-200 bg-orange-50">
                  <RefreshCw className="h-4 w-4 text-orange-600" />
                  <AlertTitle className="text-orange-800">Options changed</AlertTitle>
                  <AlertDescription className="text-orange-700">
                    Regenerate variants to sync all combinations with current options.
                  </AlertDescription>
                </Alert>
              )}

              {variantFields.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
                  No variants yet. Add options above and click &quot;Generate from Options&quot;, or add variants manually.
                </p>
              )}

              {variantFields.map((variantField, variantIndex) => {
                const variantOptions = watchedVariants?.[variantIndex]?.options ?? [];
                const selectedImageKeys = watchedVariants?.[variantIndex]?.imageKeys ?? [];

                return (
                  <div key={variantField.id} className="border rounded-md p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {variantOptions.length > 0 ? (
                          variantOptions.map((opt: { name: string; value: string }, optIdx: number) => (
                            <Badge key={`${optIdx}-${opt.name}`} variant="outline">
                              {opt.name}: {opt.value}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Manual variant</span>
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
                            <FormLabel className="text-xs">SKU</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. RED-SM" {...field} />
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
                            <FormLabel className="text-xs">Price</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={field.value}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              />
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
                            <FormLabel className="text-xs">Stock</FormLabel>
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
                            <FormLabel className="text-xs">Compare at</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="—"
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value === "" ? null : parseFloat(e.target.value) || 0)
                                }
                              />
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
                            <FormLabel className="text-xs">Cost</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="—"
                                value={field.value ?? ""}
                                onChange={(e) =>
                                  field.onChange(e.target.value === "" ? null : parseFloat(e.target.value) || 0)
                                }
                              />
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
                            <FormLabel className="text-xs">Barcode</FormLabel>
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
                              <FormLabel className="text-xs">Weight</FormLabel>
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
                              <FormLabel className="text-xs">Unit</FormLabel>
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
                        Variant images — optional. When selected on the product page, the carousel will jump to the first of these images.
                      </FormLabel>
                      {uploadedImages.length === 0 ? (
                        <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                          <ImageOff className="w-3.5 h-3.5" />
                          Upload product images first to link them to this variant.
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
              ? "Saving..."
              : mode === "create"
                ? "Create Product"
                : "Update Product"}
          </Button>
        </div>
      </form>
    </Form>
  );
}