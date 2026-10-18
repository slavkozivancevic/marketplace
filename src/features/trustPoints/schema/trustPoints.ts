import { z } from "zod";
import { TRUST_POINT_ICON_KEYS } from "../icons";

/** Longest label and sublabel the form accepts. The strip is a single row of
 *  short promises; anything longer wraps into a paragraph and stops reading as
 *  one. */
export const TRUST_POINT_LABEL_MAX_LENGTH = 60;
export const TRUST_POINT_SUBLABEL_MAX_LENGTH = 80;

// Locale-keyed translations map, same shape as tags/brands. Any supported
// locale may appear as a key; the default locale uses the canonical
// `label`/`sublabel` fields and never appears here.
const translationsSchema = z
  .record(
    z.string(),
    z
      .object({
        label: z.string().max(TRUST_POINT_LABEL_MAX_LENGTH).optional(),
        sublabel: z.string().max(TRUST_POINT_SUBLABEL_MAX_LENGTH).optional(),
      })
      .optional(),
  )
  .nullable()
  .optional();

export const createTrustPointSchema = z.object({
  label: z.string().trim().min(1).max(TRUST_POINT_LABEL_MAX_LENGTH),
  sublabel: z.string().trim().max(TRUST_POINT_SUBLABEL_MAX_LENGTH).optional(),
  // Validated against the allow-list, so a hand-crafted request cannot store a
  // key that renders as nothing.
  icon: z.enum(TRUST_POINT_ICON_KEYS),
  order: z.number().int().min(0).max(999),
  isActive: z.boolean(),
  translations: translationsSchema,
});

export const updateTrustPointSchema = createTrustPointSchema;

export type CreateTrustPointInput = z.infer<typeof createTrustPointSchema>;
export type UpdateTrustPointInput = z.infer<typeof updateTrustPointSchema>;
