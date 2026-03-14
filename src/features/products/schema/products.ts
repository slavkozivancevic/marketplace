import { z } from "zod";

export const productImageSchema = z.object({
  key: z.string(),
});

export const createProductSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  price: z.number().positive("Price must be positive"),
  images: z.array(productImageSchema).optional(),
});

export const updateProductSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  images: z.array(productImageSchema).optional(),
  version: z
    .number({
      error: "Version is required for updates",
    })
    .int()
    .positive(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
