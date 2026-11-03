import { intlLocale } from "./dateLocale";

/**
 * A plain number in the APP locale, grouped the way the reader writes numbers
 * (1.250 in sr/de/es, 1,250 in en). `toLocaleString()` with no argument uses the
 * BROWSER's locale instead - an English browser showed a Serbian page "1,250".
 */
export function formatNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(locale), { useGrouping: "always", ...options }).format(value);
}

/** An average star rating: always one decimal, with the reader's decimal mark (4,5 / 4.5). */
export function formatRating(value: number, locale: string): string {
  return formatNumber(value, locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
