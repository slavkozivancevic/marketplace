export type CategoryTranslations = {
  sr?: { name?: string; description?: string };
};

/** Returns the localized name, falling back to the default (English) name. */
export function getCategoryName(
  category: { name: string; translations: CategoryTranslations | null },
  locale: string,
): string {
  if (locale === "sr") {
    const sr = category.translations?.sr?.name?.trim();
    if (sr) return sr;
  }
  return category.name;
}

/** Returns the localized description, falling back to the default. */
export function getCategoryDescription(
  category: { description?: string | null; translations: CategoryTranslations | null },
  locale: string,
): string | null {
  if (locale === "sr") {
    const sr = category.translations?.sr?.description?.trim();
    if (sr) return sr;
  }
  return category.description ?? null;
}