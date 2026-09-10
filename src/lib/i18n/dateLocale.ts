import { LOCALE_LABELS, DEFAULT_LOCALE, isLocale } from "@/i18n/config";

/**
 * Maps the app locale to the BCP 47 tag `Intl` wants. Pulled from the central
 * locale config.
 *
 * The fallback is load-bearing, not defensive decoration: `Intl` throws a
 * `RangeError` on a tag it cannot parse, so an empty or stale locale reaching a
 * formatter would take the page down rather than merely look wrong.
 */
export function intlLocale(locale: string): string {
  const key = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return LOCALE_LABELS[key].bcp47;
}

/** The same mapping, named for its original callers. Dates and prices want the
 *  identical tag, so there is one mapping and two names for it. */
export function dateLocale(locale: string): string {
  return intlLocale(locale);
}