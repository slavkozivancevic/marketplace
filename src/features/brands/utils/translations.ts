import { pickTranslatedField, type FieldTranslations } from "@/i18n/translations";

export type BrandTranslations = FieldTranslations<"name" | "description">;

/** Returns the localized name, falling back to the default (English) name. */
export function getBrandName(
  brand: { name: string; translations: BrandTranslations | null },
  locale: string,
): string {
  return pickTranslatedField(brand.translations, locale, "name") ?? brand.name;
}

/** Returns the localized description, falling back to the default. */
export function getBrandDescription(
  brand: { description?: string | null; translations: BrandTranslations | null },
  locale: string,
): string | null {
  return (
    pickTranslatedField(brand.translations, locale, "description") ??
    brand.description ??
    null
  );
}
