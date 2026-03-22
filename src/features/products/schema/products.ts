import { z } from "zod";

export const productImageSchema = z.object({
  key: z.string().min(1, "Image key is required"),
});

export const productOptionSchema = z.object({
  name: z.string().min(1, "Option name is required"),
  values: z
    .array(z.string().min(1, "Option value is required"))
    .min(1, "At least one option value is required"),
});

export const productVariantOptionSchema = z.object({
  name: z.string().min(1, "Option name is required"),
  value: z.string().min(1, "Option value is required"),
});

export const productVariantSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  price: z.coerce.number().nonnegative("Price must be 0 or greater"),
  stock: z.coerce.number().int().nonnegative("Stock must be 0 or greater"),
  options: z
    .array(productVariantOptionSchema)
    .min(1, "Variant must have at least one option"),
});

export const createProductSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  price: z.coerce.number().nonnegative("Price must be 0 or greater"),
  images: z.array(productImageSchema).default([]),
  options: z.array(productOptionSchema).default([]),
  variants: z.array(productVariantSchema).default([]),
});

export const updateProductSchema = createProductSchema.extend({
  version: z.coerce.number().int().positive("Version is required"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// import { z } from "zod";

// export const productImageSchema = z.object({
//   key: z.string().min(1, "Image key is required"),
// });

// export const variantOptionValueInputSchema = z.object({
//   name: z.string().min(1, "Option name is required"),
//   value: z.string().min(1, "Option value is required"),
// });
// export const variantOptionInputSchema = z.object({
//   name: z.string().min(1, "Option name is required"),
//   values: z
//     .array(z.string().min(1, "Option value is required"))
//     .min(1, "At least one option value is required"),
// });
// export const productVariantSchema = z.object({
//   sku: z.string().min(1, "SKU is required"),
//   price: z.number().nonnegative("Variant price must be 0 or greater"),
//   stock: z.number().int().nonnegative("Stock must be 0 or greater"),
//   options: z.array(variantOptionValueInputSchema).default([]),
// });

// export const createProductSchema = z.object({
//   title: z.string().min(1, "Title is required"),
//   description: z.string().min(1, "Description is required"),
//   price: z.number().positive("Price must be positive"),
//   images: z.array(productImageSchema).default([]),
// });

// export const updateProductSchema = z.object({
//   title: z.string().min(1, "Title is required").optional(),
//   description: z.string().min(1, "Description is required").optional(),
//   price: z.number().positive("Price must be positive").optional(),
//   images: z.array(productImageSchema).optional(),
//   options: z.array(variantOptionInputSchema).optional(),
//   variants: z.array(productVariantSchema).optional(),
//   version: z
//     .number({
//       error: "Version is required for updates",
//     })
//     .int()
//     .positive(),
// });

// export type CreateProductInput = z.infer<typeof createProductSchema>;
// export type UpdateProductInput = z.infer<typeof updateProductSchema>;
