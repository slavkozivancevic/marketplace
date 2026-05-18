import { pickTranslatedField, type FieldTranslations } from "@/i18n/translations";

export type CategoryTranslations = FieldTranslations<"name" | "description">;

/** Returns the localized name, falling back to the default (English) name. */
export function getCategoryName(
  category: { name: string; translations: CategoryTranslations | null },
  locale: string,
): string {
  return pickTranslatedField(category.translations, locale, "name") ?? category.name;
}

/** Returns the localized description, falling back to the default. */
export function getCategoryDescription(
  category: { description?: string | null; translations: CategoryTranslations | null },
  locale: string,
): string | null {
  return (
    pickTranslatedField(category.translations, locale, "description") ??
    category.description ??
    null
  );
}
