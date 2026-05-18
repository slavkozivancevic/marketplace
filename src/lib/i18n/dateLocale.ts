import { LOCALE_LABELS, DEFAULT_LOCALE, isLocale } from "@/i18n/config";

/**
 * Maps the app locale to the BCP 47 locale tag used for Intl /
 * `toLocaleString` date formatting. Pulled from the central locale config.
 */
export function dateLocale(locale: string): string {
  const key = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return LOCALE_LABELS[key].bcp47;
}