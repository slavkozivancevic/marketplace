import { z } from "zod";

/** Longest name and slug the form accepts. Exported because `duplicateBrand`
 *  writes straight to the DB, bypassing this schema and any column length - a
 *  copy that outgrew the form would exist as a row the edit form then refuses
 *  to save. Both sides must read the same numbers. */
export const BRAND_NAME_MAX_LENGTH = 100;
export const BRAND_SLUG_MAX_LENGTH = 200;

// Locale-keyed translations map. Any locale supported by the app may appear
// as a key; the per-locale shape is validated below. The default locale
// uses the canonical columns and never appears here.
const translationsSchema = z
  .record(
    z.string(),
    z
      .object({
        name: z.string().max(BRAND_NAME_MAX_LENGTH).optional(),
        // Locale-specific URL slug. Optional - left empty, the repo computes
        // `slugify(translatedName)` as fallback so old payloads keep working.
        slug: z.string().max(BRAND_SLUG_MAX_LENGTH).optional(),
        description: z.string().max(1000).optional(),
      })
      .optional(),
  )
  .nullable()
  .optional();

export const logoBackdropSchema = z.enum(["AUTO", "LIGHT", "DARK", "NEUTRAL"]);

export const createBrandSchema = z.object({
  name: z.string().trim().min(1).max(BRAND_NAME_MAX_LENGTH),
  slug: z.string().optional(),
  logoUrl: z.url().optional().or(z.literal("")),
  // Optional second asset shown on dark surfaces (theme-following render).
  logoUrlDark: z.url().optional().or(z.literal("")),
  // Backdrop treatment per asset. `AUTO` lets the server decide from the image.
  logoBackdrop: logoBackdropSchema.optional(),
  logoBackdropDark: logoBackdropSchema.optional(),
  description: z.string().max(1000).optional(),
  translations: translationsSchema,
});

export const updateBrandSchema = createBrandSchema;

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;