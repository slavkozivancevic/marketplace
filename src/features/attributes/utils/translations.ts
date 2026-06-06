import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

type LabelRow = { locale: string; label: string };

/**
 * Resolves the display label for an attribute / option from its translation
 * rows: active locale first, then the default locale, then whatever exists.
 * Mirrors the resolution used for brands / categories.
 */
export function getLabel(
  rows: readonly LabelRow[],
  locale: string,
): string {
  return (
    rows.find((r) => r.locale === locale)?.label ??
    rows.find((r) => r.locale === DEFAULT_LOCALE)?.label ??
    rows[0]?.label ??
    ""
  );
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
