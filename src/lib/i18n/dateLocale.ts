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

/**
 * A formatted date meant to be dropped into a sentence that ends with its own
 * full stop.
 *
 * Serbian writes a date with a trailing period - `25. sep 2026.` - and that dot
 * belongs to the date, not to the sentence. Interpolated into copy that already
 * ends in one ("Pozivnica ističe {date}."), the reader gets `2026..`.
 *
 * So: strip one trailing period, and let the copy supply the sentence's. The
 * visible result in Serbian is unchanged, because the sentence's own full stop
 * lands in exactly the spot the date's did. Locales whose dates do not end in a
 * period (en, de, es here) are untouched.
 *
 * Only for copy that ends in a full stop. A bare fragment like "Ističe {date}"
 * has no period of its own and must keep the date's - use `toLocaleDateString`
 * directly there.
 */
export function dateInSentence(
  date: Date,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return date.toLocaleDateString(dateLocale(locale), options).replace(/\.$/, "");
}