import { pickTranslatedText } from "@/i18n/translations";
import { type Locale } from "@/i18n/config";

type LabelRow = { locale: string; label: string };

/**
 * Resolves the display label for an attribute / option from its translation
 * rows: active locale first, then the default locale, then whatever exists.
 * Mirrors the resolution used for brands / categories. Each step tests for a
 * non-blank label rather than a present row - see `pickTranslatedText`.
 */
export function getLabel(
  rows: readonly LabelRow[],
  locale: string,
): string {
  return pickTranslatedText(rows, locale, "label");
}

/** A variant as every order-facing query loads it: its chosen option rows. */
export type VariantWithOptions = {
  attributeValues: readonly { option: { translations: readonly LabelRow[] } }[];
} | null;

/**
 * What a buyer calls a variant, in one locale: its option labels joined, as in
 * "Bela / 42". Null when the variant has no options to name it by, so callers
 * can fall back (to the SKU, or to printing nothing) rather than render an
 * empty line.
 *
 * Shared because this is one fact about an order line, and it used to be
 * written out per page - the checkout confirmation printed the SKU where every
 * other surface printed the label, so the same line read "WHITE" there and
 * "Bela" on the order itself.
 */
export function getVariantLabel(variant: VariantWithOptions, locale: string): string | null {
  if (!variant) return null;
  return variant.attributeValues.map((av) => getLabel(av.option.translations, locale)).join(" / ") || null;
}

export type AttributeWithTranslations = {
  translations: LabelRow[];
};

export function getAttributeLabel(
  attribute: AttributeWithTranslations,
  locale: Locale | string,
): string {
  return getLabel(attribute.translations, locale);
}
