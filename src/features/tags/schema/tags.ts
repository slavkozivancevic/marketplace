import { z } from "zod";

/** Longest name and slug the form accepts. Exported because `duplicateTag`
 *  writes straight to the DB, bypassing this schema and any column length - a
 *  copy that outgrew the form would exist as a row the edit form then refuses
 *  to save. Both sides must read the same numbers. */
export const TAG_NAME_MAX_LENGTH = 100;
export const TAG_SLUG_MAX_LENGTH = 200;

// Locale-keyed translations map, same shape as brands/categories. Any locale
// supported by the app may appear as a key; the default locale uses the
// canonical `name`/`slug` fields and never appears here.
const translationsSchema = z
  .record(
    z.string(),
    z
      .object({
        name: z.string().max(TAG_NAME_MAX_LENGTH).optional(),
        // Optional - left empty, the repo falls back to slugify(name).
        slug: z.string().max(TAG_SLUG_MAX_LENGTH).optional(),
      })
      .optional(),
  )
  .nullable()
  .optional();

export const createTagSchema = z.object({
  name: z.string().trim().min(1).max(TAG_NAME_MAX_LENGTH),
  slug: z.string().optional(),
  translations: translationsSchema,
});

export const updateTagSchema = createTagSchema;

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
