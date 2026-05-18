import { z } from "zod";

// Locale-keyed translations map. Any locale supported by the app may appear
// as a key; the per-locale shape is validated below. The default locale
// uses the canonical columns and never appears here.
const translationsSchema = z
  .record(
    z.string(),
    z
      .object({
        name: z.string().max(100).optional(),
        description: z.string().max(1000).optional(),
      })
      .optional(),
  )
  .nullable()
  .optional();

export const createBrandSchema = z.object({
  name: z.string().min(1, "Brand name is required").max(100, "Brand name is too long"),
  slug: z.string().optional(),
  logoUrl: z.string().url("Logo URL must be a valid URL").optional().or(z.literal("")),
  description: z.string().max(1000, "Description is too long").optional(),
  translations: translationsSchema,
});

export const updateBrandSchema = createBrandSchema;

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;