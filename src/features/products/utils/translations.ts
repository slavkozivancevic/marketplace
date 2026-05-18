import { pickTranslatedField, type FieldTranslations } from "@/i18n/translations";

export type ProductTranslations = FieldTranslations<
  "title" | "description" | "shortDescription" | "metaTitle" | "metaDescription"
>;

type ProductLike = {
  title: string;
  description: string;
  shortDescription?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  translations: ProductTranslations | null;
};

/** Returns the localized title, falling back to the default (English) title. */
export function getProductTitle(
  product: Pick<ProductLike, "title" | "translations">,
  locale: string,
): string {
  return pickTranslatedField(product.translations, locale, "title") ?? product.title;
}

/** Returns the localized description, falling back to the default. */
export function getProductDescription(
  product: Pick<ProductLike, "description" | "translations">,
  locale: string,
): string {
  return (
    pickTranslatedField(product.translations, locale, "description") ?? product.description
  );
}

/** Returns the localized short description, falling back to the default. */
export function getProductShortDescription(
  product: Pick<ProductLike, "shortDescription" | "translations">,
  locale: string,
): string | null {
  return (
    pickTranslatedField(product.translations, locale, "shortDescription") ??
    product.shortDescription ??
    null
  );
}

/** Returns the localized meta title, falling back to the default. */
export function getProductMetaTitle(
  product: Pick<ProductLike, "metaTitle" | "translations">,
  locale: string,
): string | null {
  return (
    pickTranslatedField(product.translations, locale, "metaTitle") ??
    product.metaTitle ??
    null
  );
}

/** Returns the localized meta description, falling back to the default. */
export function getProductMetaDescription(
  product: Pick<ProductLike, "metaDescription" | "translations">,
  locale: string,
): string | null {
  return (
    pickTranslatedField(product.translations, locale, "metaDescription") ??
    product.metaDescription ??
    null
  );
}
