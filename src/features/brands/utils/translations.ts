import { pickTranslation, type FieldTranslations } from "@/i18n/translations";

/** Input shape used by forms - per-locale name/slug/description for non-default locales. */
export type BrandTranslations = FieldTranslations<"name" | "slug" | "description">;

// Helpers take the *minimum* subset of fields they actually read, so callers
// can hand them partial projections (e.g. selects that pull only `locale` +
// `name`) without TypeScript complaining about missing optional fields.
type WithName = { locale: string; name: string };
type WithSlug = { locale: string; slug: string };
type WithDescription = { locale: string; description: string | null };

/** Returns the localized name, falling back to the default-locale row. */
export function getBrandName(
  brand: { translations: readonly WithName[] },
  locale: string,
): string {
  return pickTranslation(brand.translations, locale)?.name ?? "";
}

/** Returns the localized slug, falling back to the default-locale row. */
export function getBrandSlug(
  brand: { translations: readonly WithSlug[] },
  locale: string,
): string {
  return pickTranslation(brand.translations, locale)?.slug ?? "";
}

/** Returns the localized description, falling back to the default-locale row. */
export function getBrandDescription(
  brand: { translations: readonly WithDescription[] },
  locale: string,
): string | null {
  return pickTranslation(brand.translations, locale)?.description ?? null;
}