import { z } from "zod";

import { isCountryCode } from "@/lib/i18n/countries";

/**
 * 50 years. High enough for the longest real consumer warranties (lifetime
 * cookware, structural guarantees) and low enough that a mistyped year count
 * ("2026") is rejected rather than stored.
 */
export const MAX_WARRANTY_MONTHS = 600;

export const weightUnitSchema = z.enum(["G", "KG", "LB", "OZ"]);
export const dimensionUnitSchema = z.enum(["CM", "IN"]);

export const mediaTypeSchema = z.enum(["IMAGE", "VIDEO"]);

export const productMediaSchema = z.object({
  key: z.string().min(1),
  mediaType: mediaTypeSchema.default("IMAGE"),
  thumbKey: z.string().min(1).nullable().optional(),
  mimeType: z.string().nullable().optional(),
  durationMs: z.number().int().nonnegative().nullable().optional(),
  width: z.number().int().nonnegative().nullable().optional(),
  height: z.number().int().nonnegative().nullable().optional(),
});

// Kept for back-compat with any external code still importing the old name.
export const productImageSchema = productMediaSchema;

// Locale-keyed translations map. Any locale supported by the app may appear
// as a key. The default locale uses the canonical columns and never appears
// here. `slug` is per-locale - that's what shows up in the URL for that
// locale (`/sr/proizvodi/crvena-majica`); leaving it empty falls back to a
// `slugify(title)` value computed in the repo.
export const productTranslationsSchema = z
  .record(
    z.string(),
    z
      .object({
        title: z.string().optional(),
        slug: z.string().optional(),
        description: z.string().optional(),
        shortDescription: z.string().optional(),
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
      })
      .optional(),
  )
  .nullable()
  .optional();

// A variant axis selection: which AttributeOption this variant has for a
// variant-defining attribute (controlled vocabulary, unified model).
export const productVariantOptionSchema = z.object({
  attributeId: z.string().min(1),
  optionId: z.string().min(1),
});

export const productVariantSchema = z
  .object({
    sku: z.string().min(1),
    price: z.coerce.number().positive(),
    compareAtPrice: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().nonnegative().nullable(),
    ).default(null),
    costPrice: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().nonnegative().nullable(),
    ).default(null),
    stock: z.coerce.number().int().nonnegative(),
    barcode: z.string().optional(),
    weight: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().positive().nullable(),
    ).default(null),
    weightUnit: weightUnitSchema.nullable().default(null),
    // S3 keys into ProductMedia (image OR video). The server resolves keys to
    // ProductMedia.id when writing the ProductVariantMedia join. Variants are
    // media-agnostic so a video can be showcased on a specific variant.
    mediaKeys: z.array(z.string().min(1)).default([]),
    options: z.array(productVariantOptionSchema).default([]),
  })
  .superRefine((variant, ctx) => {
    const seen = new Set<string>();
    for (const [i, opt] of variant.options.entries()) {
      if (seen.has(opt.attributeId)) {
        ctx.addIssue({
          code: "custom",
          params: { i18n: "duplicateAxis" },
          path: ["options", i, "attributeId"],
        });
      }
      seen.add(opt.attributeId);
    }
  });

function variantPayloadSignature(
  options: { attributeId: string; optionId: string }[],
): string | null {
  if (options.length === 0) return null;
  return [...options]
    .map((o) => `${o.attributeId.trim()}\u0000${o.optionId.trim()}`)
    .sort()
    .join("\u0001");
}

export const createProductSchema = z
  .object({
    title: z.string().trim().min(1),
    slug: z.string().optional(),
    description: z.string().trim().min(1),
    shortDescription: z.string().optional(),

    // Pricing
    price: z.coerce.number().positive(),
    compareAtPrice: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().nonnegative().nullable(),
    ).default(null),
    costPrice: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().nonnegative().nullable(),
    ).default(null),
    stock: z
      .preprocess(
        (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
        z.number().int().nonnegative().nullable(),
      )
      .default(null),

    // Inventory
    barcode: z.string().optional(),
    taxable: z.boolean().default(true),
    taxCode: z.string().optional(),

    // Shipping
    requiresShipping: z.boolean().default(true),
    isDigital: z.boolean().default(false),

    // Warranty and origin. `null` means "not specified"; warrantyMonths 0 is a
    // real value meaning "explicitly no warranty", so the empty-string
    // preprocess must not collapse it to null.
    warrantyMonths: z
      .preprocess(
        (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
        z.number().int().min(0).max(MAX_WARRANTY_MONTHS).nullable(),
      )
      .default(null),
    countryOfOrigin: z
      .preprocess(
        (v) =>
          typeof v === "string" && v.trim() !== "" ? v.trim().toUpperCase() : null,
        z
          .string()
          .refine(isCountryCode, { message: "unknownCountryCode" })
          .nullable(),
      )
      .default(null),
    weight: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().positive().nullable(),
    ).default(null),
    weightUnit: weightUnitSchema.nullable().default(null),
    length: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().positive().nullable(),
    ).default(null),
    width: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().positive().nullable(),
    ).default(null),
    height: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().positive().nullable(),
    ).default(null),
    dimensionUnit: dimensionUnitSchema.nullable().default(null),

    // SEO
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),

    // Translations
    translations: productTranslationsSchema,

    // Relacije
    brandId: z.string().optional(),
    categoryIds: z.array(z.string()).default([]),
    tagIds: z.array(z.string()).default([]),

    media: z.array(productMediaSchema).default([]),
    variants: z.array(productVariantSchema).default([]),

    // Catalog attribute values. One entry per attribute the product has a
    // value for. SELECT uses a single optionId, MULTI_SELECT uses several,
    // RANGE uses valueNumeric, BOOLEAN uses valueBool. Empty entries are
    // pruned client-side before submit.
    attributes: z
      .array(
        z.object({
          attributeId: z.string(),
          optionIds: z.array(z.string()).default([]),
          valueNumeric: z.number().nullable().default(null),
          valueBool: z.boolean().nullable().default(null),
        }),
      )
      .default([]),
  })
  .superRefine((data, ctx) => {
    const seenSignatures = new Map<string, number>();
    const seenSkus = new Map<string, number>();
    for (const [i, v] of data.variants.entries()) {
      const sig = variantPayloadSignature(v.options);
      if (sig !== null) {
        if (seenSignatures.has(sig)) {
          ctx.addIssue({
            code: "custom",
            params: {
              i18n: "duplicateVariantCombo",
              other: (seenSignatures.get(sig) ?? 0) + 1,
            },
            path: ["variants", i, "options"],
          });
        } else {
          seenSignatures.set(sig, i);
        }
      }
      if (seenSkus.has(v.sku)) {
        ctx.addIssue({
          code: "custom",
          params: {
            i18n: "duplicateSku",
            sku: v.sku,
            other: (seenSkus.get(v.sku) ?? 0) + 1,
          },
          path: ["variants", i, "sku"],
        });
      } else {
        seenSkus.set(v.sku, i);
      }
    }
  });

export const updateProductSchema = createProductSchema.extend({
  version: z.coerce.number().int().positive(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;