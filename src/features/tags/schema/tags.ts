import { z } from "zod";

// Locale-keyed translations map, same shape as brands/categories. Any locale
// supported by the app may appear as a key; the default locale uses the
// canonical `name`/`slug` fields and never appears here.
const translationsSchema = z
  .record(
    z.string(),
    z
      .object({
        name: z.string().max(100).optional(),
        // Optional - left empty, the repo falls back to slugify(name).
        slug: z.string().max(200).optional(),
      })
      .optional(),
  )
  .nullable()
  .optional();

export const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().optional(),
  translations: translationsSchema,
});

export const updateTagSchema = createTagSchema;

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
