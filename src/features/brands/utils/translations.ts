export type BrandTranslations = {
  sr?: { name?: string; description?: string };
};

/** Returns the localized name, falling back to the default (English) name. */
export function getBrandName(
  brand: { name: string; translations: BrandTranslations | null },
  locale: string,
): string {
  if (locale === "sr") {
    const sr = brand.translations?.sr?.name?.trim();
    if (sr) return sr;
  }
  return brand.name;
}

/** Returns the localized description, falling back to the default. */
export function getBrandDescription(
  brand: { description?: string | null; translations: BrandTranslations | null },
  locale: string,
): string | null {
  if (locale === "sr") {
    const sr = brand.translations?.sr?.description?.trim();
    if (sr) return sr;
  }
  return brand.description ?? null;
}