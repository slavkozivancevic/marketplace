"use client";

import { useState, useTransition, KeyboardEvent } from "react";
import { useForm, useFieldArray, useWatch, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/components/ui/sonner";
import {
  Form,
  FormControl,
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
import { X, Plus, RefreshCw } from "lucide-react";

type ProductFormData = {
  title: string;
  description: string;
  price: number;
  stock: number | null;
  images: { key: string }[];
  options: { name: string; values: string[] }[];
  variants: {
    sku: string;
    price: number;
    stock: number;
    options: { name: string; value: string }[];
  }[];
  version: number;
};

type OptionSnapshot = { name: string; values: string[] };

function snapshotOptions(
  options: { name: string; values: string[] }[],
): OptionSnapshot[] {
  return options.map((o) => ({
    name: o.name,
    values: [...o.values].sort(),
  }));
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

interface ProductFormProps {
  mode: "create" | "update";
  product?: SerializedProductWithRelations;
  onSuccess?: () => void;
  redirectTo?: string;
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

export function ProductForm({
  mode,
  product,
  onSuccess,
  redirectTo,
}: ProductFormProps) {
  const [isPending, startTransition] = useTransition();

  const [uploadedImages, setUploadedImages] = useState<
    PresignedUploadedImage[]
  >(product?.images.map((img) => ({ key: img.key, url: img.url })) ?? []);

  const [optionValueInputs, setOptionValueInputs] = useState<string[]>(
    () => product?.options.map(() => "") ?? [],
  );

  const [syncedOptionsSnapshot, setSyncedOptionsSnapshot] = useState<
    OptionSnapshot[]
  >(() =>
    snapshotOptions(
      product?.options.map((opt) => ({
        name: opt.name,
        values: Array.from(new Set(opt.values.map((v) => v.value))),
      })) ?? [],
    ),
  );

  const optionById = new Map(product?.options.map((o) => [o.id, o.name]) ?? []);

  const schema = mode === "create" ? createProductSchema : updateProductSchema;

  const form = useForm<ProductFormData>({
    resolver: zodResolver(schema) as unknown as Resolver<ProductFormData>,
    defaultValues: product
      ? {
          title: product.title,
          description: product.description,
          price: product.price,
          stock: product.stock ?? null,
          images: product.images.map((img) => ({ key: img.key })),
          options: product.options.map((opt) => ({
            name: opt.name,
            values: Array.from(new Set(opt.values.map((v) => v.value))),
          })),
          variants: product.variants.map((v) => ({
            sku: v.sku,
            price: v.price,
            stock: v.stock,
            options: v.optionValues.map((ov) => ({
              name: optionById.get(ov.optionId) ?? "",
              value: ov.value,
            })),
          })),
          version: product.version,
        }
      : {
          title: "",
          description: "",
          price: 0,
          stock: null,
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

  const optionsChanged = !optionsAreSynced(
    watchedOptions,
    syncedOptionsSnapshot,
  );

  const handleAddOptionValue = (optionIndex: number) => {
    const input = optionValueInputs[optionIndex]?.trim();
    if (!input) return;

    const current = form.getValues(`options.${optionIndex}.values`) ?? [];
    if (current.includes(input)) {
      toast.error("Value already exists");
      return;
    }

    form.setValue(`options.${optionIndex}.values`, [...current, input]);
    setOptionValueInputs((prev) => {
      const next = [...prev];
      next[optionIndex] = "";
      return next;
    });
  };

  const handleRemoveOptionValue = (optionIndex: number, value: string) => {
    const current = form.getValues(`options.${optionIndex}.values`) ?? [];
    form.setValue(
      `options.${optionIndex}.values`,
      current.filter((v) => v !== value),
    );
  };

  const handleOptionValueKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    optionIndex: number,
  ) => {
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

    replaceVariants(
      combinations.map((combo) => ({
        sku: combo.map((o) => o.value.toUpperCase().slice(0, 3)).join("-"),
        price: form.getValues("price"),
        stock: 0,
        options: combo,
      })),
    );

    setSyncedOptionsSnapshot(snapshotOptions(options));
    toast.success(`Generated ${combinations.length} variant(s)`);
  };

  const handleImageUpload = (images: PresignedUploadedImage[]) => {
    setUploadedImages(images);
    form.setValue(
      "images",
      images.map((img) => ({ key: img.key })),
    );
  };

  const onSubmit = (data: ProductFormData) => {
    startTransition(async () => {
      let result;

      if (mode === "create") {
        const createData: CreateProductInput = {
          title: data.title,
          description: data.description,
          price: data.price,
          stock: data.variants.length === 0 ? data.stock : null,
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
        toast.success(
          mode === "create" ? "Product created" : "Product updated",
        );
        onSuccess?.();
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* ── Basic Info ── */}
        <div className="space-y-4">
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
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Product description" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base Price</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={field.value}
                    onChange={(e) =>
                      field.onChange(parseFloat(e.target.value) || 0)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {watchedVariants?.length === 0 && (
            <FormField
              control={form.control}
              name="stock"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Stock
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      — leave blank for unlimited
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Unlimited"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? null : parseInt(e.target.value, 10),
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <Separator />

        {/* ── Images ── */}
        <div className="space-y-2">
          <FormLabel className="text-base font-semibold">Images</FormLabel>
          <ProductImageUpload
            onUploadComplete={handleImageUpload}
            initialImages={uploadedImages}
          />
        </div>

        <Separator />

        {/* ── Options ── */}
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
              No options added. Click &quot;Add Option&quot; to add product
              options like Color or Size.
            </p>
          )}

          {optionFields.map((optionField, optionIndex) => {
            const values = watchedOptions?.[optionIndex]?.values ?? [];

            return (
              <div
                key={optionField.id}
                className="border rounded-md p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name={`options.${optionIndex}.name`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            placeholder="Option name (e.g. Color)"
                            {...field}
                          />
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
                      setOptionValueInputs((prev) =>
                        prev.filter((_, i) => i !== optionIndex),
                      );
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
                          onClick={() =>
                            handleRemoveOptionValue(optionIndex, value)
                          }
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
                      onKeyDown={(e) =>
                        handleOptionValueKeyDown(e, optionIndex)
                      }
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
                      {
                        form.formState.errors.options[optionIndex]?.values
                          ?.message
                      }
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* ── Variants ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Variants</h3>
              <p className="text-sm text-muted-foreground">
                Each variant has its own SKU, price and stock.
              </p>
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
                    stock: 0,
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
              <AlertTitle className="text-orange-800">
                Options changed
              </AlertTitle>
              <AlertDescription className="text-orange-700">
                Regenerate variants to sync all combinations with current
                options.
              </AlertDescription>
            </Alert>
          )}

          {variantFields.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
              No variants yet. Add options above and click &quot;Generate from
              Options&quot;, or add variants manually.
            </p>
          )}

          {variantFields.map((variantField, variantIndex) => {
            const variantOptions =
              watchedVariants?.[variantIndex]?.options ?? [];

            return (
              <div
                key={variantField.id}
                className="border rounded-md p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {variantOptions.length > 0 ? (
                      variantOptions.map(
                        (opt: { name: string; value: string }) => (
                          <Badge
                            key={`${opt.name}-${opt.value}`}
                            variant="outline"
                          >
                            {opt.name}: {opt.value}
                          </Badge>
                        ),
                      )
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Manual variant
                      </span>
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
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
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
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value) || 0)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Saving..."
            : mode === "create"
              ? "Create Product"
              : "Update Product"}
        </Button>
      </form>
    </Form>
  );
}
