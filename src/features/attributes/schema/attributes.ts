import { z } from "zod";

export const ATTRIBUTE_TYPES = [
  "SELECT",
  "MULTI_SELECT",
  "RANGE",
  "BOOLEAN",
] as const;

export type AttributeTypeValue = (typeof ATTRIBUTE_TYPES)[number];

/** Types whose facet is driven by a fixed list of predefined options. */
export const OPTION_TYPES: readonly AttributeTypeValue[] = [
  "SELECT",
  "MULTI_SELECT",
];

// Locale-keyed label map. Any supported locale may appear as a key; the
// default locale uses the canonical `label` field and never appears here.
const labelTranslationsSchema = z
  .record(
    z.string(),
    z.object({ label: z.string().max(100).optional() }).optional(),
  )
  .nullable()
  .optional();

const optionSchema = z.object({
  // Present when editing an existing option so the repo can preserve its id
  // (and therefore any ProductAttributeValue rows pointing at it).
  id: z.string().optional(),
  // Machine value; auto-derived from the label when left blank.
  value: z.string().max(80).optional(),
  label: z.string().min(1).max(100),
  translations: labelTranslationsSchema,
  order: z.number().int().min(0),
});

export type AttributeOptionInput = z.infer<typeof optionSchema>;

export const attributeSchema = z
  .object({
    // Stable machine key; auto-derived from the default label when blank.
    key: z.string().max(80).optional(),
    type: z.enum(ATTRIBUTE_TYPES),
    // Unit suffix shown next to RANGE values (e.g. "inch", "GB").
    unit: z.string().max(20).optional(),
    label: z.string().min(1).max(100),
    translations: labelTranslationsSchema,
    order: z.number().int().min(0),
    options: z.array(optionSchema),
  })
  .superRefine((data, ctx) => {
    if (OPTION_TYPES.includes(data.type) && data.options.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        params: { i18n: "selectNeedsOption" },
      });
    }
  });

export type AttributeInput = z.infer<typeof attributeSchema>;
