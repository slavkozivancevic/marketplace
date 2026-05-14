import { z } from "zod";

const urlOrEmpty = z
  .string()
  .refine(
    (v) => v === "" || /^https?:\/\/.+/.test(v),
    "Must be a valid URL starting with http:// or https://",
  )
  .optional();

const translationsSchema = z
  .object({
    sr: z
      .object({
        name: z.string().max(100).optional(),
        description: z.string().max(500).optional(),
      })
      .optional(),
  })
  .optional()
  .nullable();

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  slug: z.string().optional(),
  parentId: z.string().optional().nullable(),
  imageUrl: urlOrEmpty,
  description: z.string().max(500).optional(),
  translations: translationsSchema,
  order: z.number().int().min(0),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
});

export type CategoryInput = z.infer<typeof categorySchema>;