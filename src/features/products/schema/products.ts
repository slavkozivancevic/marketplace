import { z } from "zod";

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
    stock: z.coerce.number().int().nonnegative("Stock must be 0 or greater"),
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
    description: z.string().min(1, "Description is required"),
    price: z.coerce.number().nonnegative("Price must be 0 or greater"),
    stock: z
      .preprocess(
        (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
        z.number().int().nonnegative("Stock must be 0 or greater").nullable(),
      )
      .default(null),
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
