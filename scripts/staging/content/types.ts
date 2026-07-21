// Shared types for the staging catalog curation dataset.

export type Locale = "en" | "sr" | "de" | "es";

export type ProductLocaleContent = {
  title: string;
  /** shortDescription - one sentence, also feeds metaDescription + searchText */
  short: string;
  /** description - 2-4 sentences */
  desc: string;
};

/**
 * What to do with a product's variants.
 * - keep: leave existing variants untouched
 * - none: delete every variant that has no order items; product falls back to
 *   simple stock (sum of removed variant stocks)
 * - colors: prune color variants outside the palette (order-referenced ones stay)
 * - options: replace variants with a single-axis set on `attrKey` (existing
 *   deletable variants removed first; order-referenced ones stay)
 */
export type VariantPlan =
  | { mode: "keep" }
  | { mode: "none" }
  | { mode: "colors"; palette: string[] }
  | {
      mode: "options";
      attrKey: "volume" | "platform" | "color";
      options: { value: string; priceFactor: number; stock: number }[];
    };

export type ProductContent = {
  /** EN brand slug to (re)assign, null clears the brand, "keep" leaves as-is */
  brand: string | null | "keep";
  variants: VariantPlan;
  t: Record<Locale, ProductLocaleContent>;
};

export type BrandContent = {
  /** EN slug (also becomes the slug for every locale) */
  slug: string;
  name: string;
  /** Wikimedia Commons file name candidates, tried in order */
  logoFiles: string[];
  desc: Record<Locale, string>;
};

export type CategoryContent = {
  /** localized display names; en/sr mostly match the seed */
  names: Record<Locale, string>;
  /** localized slugs; en keeps the seed slug */
  slugs: Record<Locale, string>;
  desc: Record<Locale, string>;
};
