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

export type AttributeWithTranslations = {
  translations: LabelRow[];
};

export function getAttributeLabel(
  attribute: AttributeWithTranslations,
  locale: Locale | string,
): string {
  return getLabel(attribute.translations, locale);
}
