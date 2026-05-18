import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";

/**
 * VariantOption translations. Per locale, the option may have a translated
 * `name` and a `values` record mapping the canonical option value to its
 * translation (e.g. `{ "Red": "Crvena" }`).
 */
export type OptionTranslations = Partial<
  Record<Locale, { name?: string; values?: Record<string, string> }>
>;

/** Returns the localized option name, falling back to the default (English) name. */
export function getOptionName(
  option: { name: string; translations: OptionTranslations | null },
  locale: string,
): string {
  if (locale !== DEFAULT_LOCALE && option.translations && isLocale(locale)) {
    const translated = option.translations[locale]?.name?.trim();
    if (translated) return translated;
  }
  return option.name;
}

/** Returns the localized option value, falling back to the default (English) value. */
export function getOptionValue(
  option: { translations: OptionTranslations | null },
  value: string,
  locale: string,
): string {
  if (locale !== DEFAULT_LOCALE && option.translations && isLocale(locale)) {
    const translated = option.translations[locale]?.values?.[value]?.trim();
    if (translated) return translated;
  }
  return value;
}
