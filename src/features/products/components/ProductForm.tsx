"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import { ProductImageUpload } from "@/components/product/ProductImageUpload";
import {
  createProductSchema,
  updateProductSchema,
  CreateProductInput,
  UpdateProductInput,
} from "../schema/products";
import { createProduct, updateProduct } from "../actions/products";
import { ProductWithRelations, PresignedUploadedImage } from "@/types/types";

type ProductFormData = CreateProductInput & { version?: number };

interface ProductFormProps {
  mode: "create" | "update";
  product?: ProductWithRelations;
  onSuccess?: () => void;
}

export function ProductForm({ mode, product, onSuccess }: ProductFormProps) {
  const [isPending, startTransition] = useTransition();
  const [uploadedImages, setUploadedImages] = useState<PresignedUploadedImage[]>(
    product?.images.map(img => ({ key: img.key, url: img.url })) || []
  );

  const form = useForm({
    resolver: zodResolver(mode === "create" ? createProductSchema : updateProductSchema),
    defaultValues: product
      ? {
          title: product.title,
          description: product.description,
          price: Number(product.price),
          images: product.images.map(img => ({ key: img.key })),
          options: product.options.map(opt => ({
            name: opt.name,
            values: opt.values.map(v => v.value),
          })),
          variants: [], // TODO
          ...(mode === "update" && { version: product.version }),
        }
      : {
          title: "",
          description: "",
          price: 0,
          images: [],
          options: [],
          variants: [],
        },
  });

  const onSubmit = (data: ProductFormData) => {
    startTransition(async () => {
      const result = mode === "create"
        ? await createProduct(data as CreateProductInput)
        : await updateProduct(product!.id, data as UpdateProductInput);

      if (result && "error" in result) {
        toast.error(result.message);
      } else {
        toast.success(mode === "create" ? "Product created" : "Product updated");
        onSuccess?.();
      }
    });
  };

  const handleImageUpload = (images: PresignedUploadedImage[]) => {
    setUploadedImages(images);
    form.setValue("images", images.map(img => ({ key: img.key })));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
              <FormLabel>Price</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...field}
                  value={field.value as string}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div>
          <FormLabel>Images</FormLabel>
          <ProductImageUpload
            onUploadComplete={handleImageUpload}
            initialImages={uploadedImages}
          />
        </div>

        {/* TODO: Add options and variants fields */}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : mode === "create" ? "Create Product" : "Update Product"}
        </Button>
      </form>
    </Form>
  );
}