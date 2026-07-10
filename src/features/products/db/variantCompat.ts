import { Prisma } from "@/generated/prisma/client";
import { SUPPORTED_LOCALES } from "@/i18n/config";
import { getLabel } from "@/features/attributes/utils/translations";
import type {
  PublicProductRaw,
  SerializedPublicProduct,
  CompatProductOption,
  CompatVariantOptionValue,
} from "@/types/types";

/**
 * Shared Prisma include for fetching a public product under the unified variant
 * model. Variant axis values live on `variants[].attributeValues` (controlled
 * AttributeOption vocabulary).
 */
export const publicProductInclude = {
  translations: true,
  // `id` breaks ties so equal `order` values sort deterministically (legacy
  // rows written before the insert-order fix could share an `order`).
  media: { orderBy: [{ order: "asc" }, { id: "asc" }] },
  variants: {
    orderBy: { order: "asc" },
    include: {
      attributeValues: {
        include: {
          attribute: { select: { id: true, key: true, translations: true } },
          option: { select: { id: true, value: true, translations: true } },
        },
      },
      media: { orderBy: { order: "asc" }, include: { media: true } },
    },
  },
  brand: { select: { id: true, logoUrl: true, logoUrlDark: true, logoBackdrop: true, logoBackdropDark: true, translations: true } },
} satisfies Prisma.ProductInclude;

type RawVariant = PublicProductRaw["variants"][number];

/**
 * Synthesizes the legacy `product.options` shape from the distinct
 * variant-defining attributes used across a product's variants, so the existing
 * storefront UI (purchase section, cart, quick view) renders unchanged.
 */
export function buildCompatOptions(
  variants: RawVariant[],
): CompatProductOption[] {
  const attrs = new Map<
    string,
    { attr: RawVariant["attributeValues"][number]["attribute"]; options: Map<string, RawVariant["attributeValues"][number]["option"]> }
  >();

  for (const v of variants) {
    for (const av of v.attributeValues) {
      let entry = attrs.get(av.attributeId);
      if (!entry) {
        entry = { attr: av.attribute, options: new Map() };
        attrs.set(av.attributeId, entry);
      }
      if (!entry.options.has(av.option.value)) {
        entry.options.set(av.option.value, av.option);
      }
    }
  }

  const result: CompatProductOption[] = [];
  for (const [attrId, { attr, options }] of attrs) {
    const translations = SUPPORTED_LOCALES.map((loc) => {
      const values: Record<string, string> = {};
      for (const [val, opt] of options) values[val] = getLabel(opt.translations, loc);
      return { locale: loc, name: getLabel(attr.translations, loc), values };
    });
    result.push({
      id: attrId,
      translations,
      values: [...options.keys()].map((value) => ({ value })),
    });
  }
  return result;
}

export function buildCompatVariantOptionValues(
  v: RawVariant,
): CompatVariantOptionValue[] {
  return v.attributeValues.map((av) => ({
    id: av.id,
    optionId: av.attributeId,
    value: av.option.value,
  }));
}

/** Serializes a raw public product into the back-compat storefront shape. */
export function serializePublicProduct(
  product: PublicProductRaw,
): SerializedPublicProduct {
  return {
    ...product,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice != null ? Number(product.compareAtPrice) : null,
    costPrice: product.costPrice != null ? Number(product.costPrice) : null,
    options: buildCompatOptions(product.variants),
    variants: product.variants.map((v) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { attributeValues, ...rest } = v;
      return {
        ...rest,
        price: Number(v.price),
        compareAtPrice: v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
        costPrice: v.costPrice != null ? Number(v.costPrice) : null,
        optionValues: buildCompatVariantOptionValues(v),
      };
    }),
  };
}
