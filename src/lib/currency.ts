import type { Currency } from "@/lib/currency-config";
import { intlLocale } from "@/lib/i18n/dateLocale";

export interface CurrencyConfig {
  code: Currency;
  label: string;
  symbol: string;
  /** ISO 4217 minor-unit exponent (2 for USD/EUR/RSD). Storage and Stripe both
   *  use this scale, so it is not a presentation choice. */
  decimalPlaces: number;
  /**
   * Granularity, in minor units, that a DERIVED amount is rounded to. One minor
   * unit everywhere: a conversion is rounded to the smallest amount the currency
   * has and nothing beyond that is thrown away.
   *
   * RSD used to be rounded to a whole dinar here, on the argument that nobody
   * shelves a price of "15.313,70". That cost up to 50 para of accuracy on every
   * converted price to tidy up a number the seller never typed, and a seller who
   * wants a round dinar price can always author one - authored amounts are never
   * touched by this at all.
   *
   * Never applied to an amount a human typed: what the seller enters is stored
   * verbatim, para included.
   */
  derivedStep: number;
}

// No per-currency `locale` here any more: how a number is written down follows
// the reader, so `formatPrice` takes the app locale instead.
export const CURRENCIES: CurrencyConfig[] = [
  { code: "usd", label: "USD", symbol: "$",   decimalPlaces: 2, derivedStep: 1 },
  { code: "eur", label: "EUR", symbol: "€",   decimalPlaces: 2, derivedStep: 1 },
  { code: "rsd", label: "RSD", symbol: "RSD", decimalPlaces: 2, derivedStep: 1 },
];

const currencyMap = new Map(CURRENCIES.map((c) => [c.code, c]));

export function getCurrencyConfig(currency: Currency): CurrencyConfig {
  return currencyMap.get(currency) ?? CURRENCIES[0];
}

/**
 * Formats an amount stored in the smallest unit (cents/para) into a
 * human-readable string, grouped and punctuated the way `locale` writes numbers.
 *
 * `locale` is the APP locale (the reader), not the currency's home locale. Which
 * currency the money is in decides the symbol; how a number is written down is a
 * property of who is reading it. Formatting every RSD amount in `sr-RS` meant an
 * English-speaking buyer saw "3.253,92 RSD", where "3.253" reads as three point
 * something - the one combination here that is genuinely misread.
 *
 * The two non-default `Intl` options are what make that switch free of
 * regressions:
 * - `narrowSymbol`, or USD outside en turns into "29,99 US$" instead of "29,99 $"
 * - `useGrouping: "always"`, or es-ES drops the separator on four digits and
 *   renders "3253,92"
 *
 * @example
 *   formatPrice(2999, "usd", "en")   // "$29.99"
 *   formatPrice(2999, "usd", "sr")   // "29,99 $"
 *   formatPrice(325392, "rsd", "en") // "RSD 3,253.92"
 *   formatPrice(325392, "rsd", "sr") // "3.253,92 RSD"
 */
export function formatPrice(
  amountInSmallestUnit: number,
  currency: Currency,
  locale: string,
): string {
  const config = getCurrencyConfig(currency);
  const divisor = Math.pow(10, config.decimalPlaces);
  const amount = amountInSmallestUnit / divisor;
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    // Use the resolved config's code (getCurrencyConfig falls back to a valid
    // currency) - never the raw param, which could be an empty/unknown string
    // (e.g. a stale persisted value) and would throw "Invalid currency code".
    currency: config.code.toUpperCase(),
    currencyDisplay: "narrowSymbol",
    useGrouping: "always",
    minimumFractionDigits: config.decimalPlaces,
    maximumFractionDigits: config.decimalPlaces,
  }).format(amount);
}

/**
 * Converts a price from USD cents to the smallest unit of the target currency
 * using the provided exchange rate (1 USD = `rate` of target currency).
 *
 * @deprecated for anything a user sees as a price. Live conversion on the
 * display path is what made a saved "1.000,05 RSD" read back as "1.000,37 RSD",
 * and made every price move on its own whenever the daily rate updated. Prices,
 * shipping fees and coupon amounts now store one exact amount per currency -
 * see `MoneySet` in `src/lib/money.ts` and read them with `moneyIn()`.
 *
 * Still correct for the remaining USD-only quantities that are thresholds
 * rather than prices (a coupon minimum, a free-shipping target) when they are
 * being rendered as a hint, where being a dinar off is harmless.
 *
 * @example
 *   convertCents(2999, "eur", 0.921)  // 2762 (EUR cents)
 *   convertCents(2999, "rsd", 108.5)  // 325390 (para)
 *   convertCents(2999, "usd", 1.0)    // 2999 (unchanged)
 */
export function convertCents(
  usdCents: number,
  targetCurrency: Currency,
  rate: number,
): number {
  if (targetCurrency === "usd") return usdCents;
  return Math.round(usdCents * rate);
}

/**
 * Converts a price in the smallest unit back to a decimal for human display
 * or form input (e.g. for price fields in product forms).
 *
 * @example
 *   centsToDecimal(2999)  // 29.99
 */
export function centsToDecimal(amountInSmallestUnit: number): number {
  return amountInSmallestUnit / 100;
}

/**
 * Converts a decimal price (e.g. from a form input) to the smallest unit.
 * Always rounds to avoid floating-point artifacts.
 *
 * @example
 *   decimalToCents(29.99)  // 2999
 *   decimalToCents(29.999) // 3000
 */
export function decimalToCents(decimalAmount: number): number {
  return Math.round(decimalAmount * 100);
}