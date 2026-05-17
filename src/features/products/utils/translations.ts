export type ProductTranslations = {
  sr?: {
    title?: string;
    description?: string;
    shortDescription?: string;
    metaTitle?: string;
    metaDescription?: string;
  };
};

type ProductLike = {
  title: string;
  description: string;
  shortDescription?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  translations: ProductTranslations | null;
};

function pickSr(translations: ProductTranslations | null, field: keyof NonNullable<ProductTranslations["sr"]>): string | null {
  const sr = translations?.sr?.[field]?.trim();
  return sr && sr.length > 0 ? sr : null;
}

/** Returns the localized title, falling back to the default (English) title. */
export function getProductTitle(
  product: Pick<ProductLike, "title" | "translations">,
  locale: string,
): string {
  if (locale === "sr") {
    const sr = pickSr(product.translations, "title");
    if (sr) return sr;
  }
  return product.title;
}

/** Returns the localized description, falling back to the default. */
export function getProductDescription(
  product: Pick<ProductLike, "description" | "translations">,
  locale: string,
): string {
  if (locale === "sr") {
    const sr = pickSr(product.translations, "description");
    if (sr) return sr;
  }
  return product.description;
}

/** Returns the localized short description, falling back to the default. */
export function getProductShortDescription(
  product: Pick<ProductLike, "shortDescription" | "translations">,
  locale: string,
): string | null {
  if (locale === "sr") {
    const sr = pickSr(product.translations, "shortDescription");
    if (sr) return sr;
  }
  return product.shortDescription ?? null;
}

/** Returns the localized meta title, falling back to the default. */
export function getProductMetaTitle(
  product: Pick<ProductLike, "metaTitle" | "translations">,
  locale: string,
): string | null {
  if (locale === "sr") {
    const sr = pickSr(product.translations, "metaTitle");
    if (sr) return sr;
  }
  return product.metaTitle ?? null;
}

/** Returns the localized meta description, falling back to the default. */
export function getProductMetaDescription(
  product: Pick<ProductLike, "metaDescription" | "translations">,
  locale: string,
): string | null {
  if (locale === "sr") {
    const sr = pickSr(product.translations, "metaDescription");
    if (sr) return sr;
  }
  return product.metaDescription ?? null;
}
