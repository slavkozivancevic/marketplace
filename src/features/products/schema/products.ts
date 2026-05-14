import { z } from "zod";

export const weightUnitSchema = z.enum(["G", "KG", "LB", "OZ"]);
export const dimensionUnitSchema = z.enum(["CM", "IN"]);

export const productImageSchema = z.object({
  key: z.string().min(1, "Image key is required"),
});

export const productOptionSchema = z.object({
  name: z.string().min(1, "Option name is required"),
  values: z
    .array(z.string().min(1, "Option value is required"))
    .min(1, "At least one option value is required"),
});

export const productVariantOptionSchema = z.object({
  name: z.string().min(1, "Option name is required"),
  value: z.string().min(1, "Option value is required"),
});

export const productVariantSchema = z
  .object({
    sku: z.string().min(1, "SKU is required"),
    price: z.coerce.number().nonnegative("Price must be 0 or greater"),
    compareAtPrice: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().nonnegative("Compare at price must be 0 or greater").nullable(),
    ).default(null),
    costPrice: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().nonnegative("Cost price must be 0 or greater").nullable(),
    ).default(null),
    stock: z.coerce.number().int().nonnegative("Stock must be 0 or greater"),
    barcode: z.string().optional(),
    weight: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().positive("Weight must be greater than 0").nullable(),
    ).default(null),
    weightUnit: weightUnitSchema.nullable().default(null),
    imageKeys: z.array(z.string().min(1)).default([]),
    options: z.array(productVariantOptionSchema).default([]),
  })
  .superRefine((variant, ctx) => {
    const seen = new Set<string>();
    for (const [i, opt] of variant.options.entries()) {
      if (seen.has(opt.name)) {
        ctx.addIssue({
          code: "custom",
          message: `Variant has duplicate option "${opt.name}"`,
          path: ["options", i, "name"],
        });
      }
      seen.add(opt.name);
    }
  });

function variantPayloadSignature(
  options: { name: string; value: string }[],
): string | null {
  if (options.length === 0) return null;
  return [...options]
    .map((o) => `${o.name.trim()}\u0000${o.value.trim()}`)
    .sort()
    .join("\u0001");
}

export const createProductSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    slug: z.string().optional(),
    description: z.string().min(1, "Description is required"),
    shortDescription: z.string().optional(),

    // Pricing
    price: z.coerce.number().nonnegative("Price must be 0 or greater"),
    compareAtPrice: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().nonnegative("Compare at price must be 0 or greater").nullable(),
    ).default(null),
    costPrice: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().nonnegative("Cost price must be 0 or greater").nullable(),
    ).default(null),
    stock: z
      .preprocess(
        (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
        z.number().int().nonnegative("Stock must be 0 or greater").nullable(),
      )
      .default(null),

    // Inventory
    barcode: z.string().optional(),
    taxable: z.boolean().default(true),
    taxCode: z.string().optional(),

    // Shipping
    requiresShipping: z.boolean().default(true),
    isDigital: z.boolean().default(false),
    weight: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().positive("Weight must be greater than 0").nullable(),
    ).default(null),
    weightUnit: weightUnitSchema.nullable().default(null),
    length: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().positive("Length must be greater than 0").nullable(),
    ).default(null),
    width: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().positive("Width must be greater than 0").nullable(),
    ).default(null),
    height: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().positive("Height must be greater than 0").nullable(),
    ).default(null),
    dimensionUnit: dimensionUnitSchema.nullable().default(null),

    // SEO
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),

    // Relacije
    brandId: z.string().optional(),
    categoryIds: z.array(z.string()).default([]),

    images: z.array(productImageSchema).default([]),
    options: z.array(productOptionSchema).default([]),
    variants: z.array(productVariantSchema).default([]),
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
            message: `Duplicate variant option combination (also at variant #${(seenSignatures.get(sig) ?? 0) + 1})`,
            path: ["variants", i, "options"],
          });
        } else {
          seenSignatures.set(sig, i);
        }
      }
      if (seenSkus.has(v.sku)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate SKU "${v.sku}" (also at variant #${(seenSkus.get(v.sku) ?? 0) + 1})`,
          path: ["variants", i, "sku"],
        });
      } else {
        seenSkus.set(v.sku, i);
      }
    }
  });

export const updateProductSchema = createProductSchema.extend({
  version: z.coerce.number().int().positive("Version is required"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;