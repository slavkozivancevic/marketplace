import { z } from "zod";

const urlOrEmpty = z
  .string()
  .refine(
    (v) => v === "" || /^https?:\/\/.+/.test(v),
    "Must be a valid URL starting with http:// or https://",
  )
  .optional();

// Locale-keyed translations map. Any locale supported by the app may appear
// as a key. The default locale uses the canonical columns and never appears here.
const translationsSchema = z
  .record(
    z.string(),
    z
      .object({
        name: z.string().max(100).optional(),
        // Locale-specific URL slug. Left empty, the repo falls back to
        // `slugify(translatedName)`.
        slug: z.string().max(200).optional(),
        description: z.string().max(500).optional(),
      })
      .optional(),
  )
  .nullable()
  .optional();

// Attributes assigned directly to this category (department-level assignments
// are inherited by descendants and are not repeated here).
const categoryAttributesSchema = z.array(
  z.object({
    attributeId: z.string(),
    order: z.number().int().min(0),
    isFilterable: z.boolean(),
  }),
);

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
  attributes: categoryAttributesSchema,
});

export type CategoryInput = z.infer<typeof categorySchema>;