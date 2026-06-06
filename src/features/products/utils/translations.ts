import { pickTranslation, type FieldTranslations } from "@/i18n/translations";

/** Input shape used by forms - per-locale text fields for non-default locales. */
export type ProductTranslations = FieldTranslations<
  "title" | "slug" | "description" | "shortDescription" | "metaTitle" | "metaDescription"
>;

// Each helper takes the minimum projection it actually reads. Callers can
// hand over slim selects (e.g. just `{ locale, title }`) without satisfying
// every optional field on the underlying ProductTranslation row.
type WithTitle = { locale: string; title: string };
type WithSlug = { locale: string; slug: string };
type WithDescription = { locale: string; description: string };
type WithShortDescription = { locale: string; shortDescription: string | null };
type WithMetaTitle = { locale: string; metaTitle: string | null };
type WithMetaDescription = { locale: string; metaDescription: string | null };

/** Returns the localized title, falling back to the default-locale row. */
export function getProductTitle(
  product: { translations: readonly WithTitle[] },
  locale: string,
): string {
  return pickTranslation(product.translations, locale)?.title ?? "";
}

/** Returns the localized slug, falling back to the default-locale row. */
export function getProductSlug(
  product: { translations: readonly WithSlug[] },
  locale: string,
): string {
  return pickTranslation(product.translations, locale)?.slug ?? "";
}

/** Returns the localized description, falling back to the default-locale row. */
export function getProductDescription(
  product: { translations: readonly WithDescription[] },
  locale: string,
): string {
  return pickTranslation(product.translations, locale)?.description ?? "";
}

/** Returns the localized short description, falling back to the default-locale row. */
export function getProductShortDescription(
  product: { translations: readonly WithShortDescription[] },
  locale: string,
): string | null {
  return pickTranslation(product.translations, locale)?.shortDescription ?? null;
}

/** Returns the localized meta title, falling back to the default-locale row. */
export function getProductMetaTitle(
  product: { translations: readonly WithMetaTitle[] },
  locale: string,
): string | null {
  return pickTranslation(product.translations, locale)?.metaTitle ?? null;
}

/** Returns the localized meta description, falling back to the default-locale row. */
export function getProductMetaDescription(
  product: { translations: readonly WithMetaDescription[] },
  locale: string,
): string | null {
  return pickTranslation(product.translations, locale)?.metaDescription ?? null;
}
