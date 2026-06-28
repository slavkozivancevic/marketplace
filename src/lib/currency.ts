import type { Currency } from "@/lib/currency-config";

export interface CurrencyConfig {
  code: Currency;
  label: string;
  symbol: string;
  /** BCP 47 locale used for Intl.NumberFormat */
  locale: string;
  /** Number of decimal places (e.g. 2 for USD/EUR/RSD) */
  decimalPlaces: number;
}

export const CURRENCIES: CurrencyConfig[] = [
  { code: "usd", label: "USD", symbol: "$",   locale: "en-US", decimalPlaces: 2 },
  { code: "eur", label: "EUR", symbol: "€",   locale: "de-DE", decimalPlaces: 2 },
  { code: "rsd", label: "RSD", symbol: "RSD", locale: "sr-RS", decimalPlaces: 2 },
];

const currencyMap = new Map(CURRENCIES.map((c) => [c.code, c]));

export function getCurrencyConfig(currency: Currency): CurrencyConfig {
  return currencyMap.get(currency) ?? CURRENCIES[0];
}

/**
 * Formats an amount stored in the smallest unit (cents/para) into a
 * human-readable string for the given currency.
 *
 * @example
 *   formatPrice(2999, "usd")  // "$29.99"
 *   formatPrice(2761, "eur")  // "27,61 €"
 *   formatPrice(325392, "rsd") // "3.253,92 RSD"
 */
export function formatPrice(amountInSmallestUnit: number, currency: Currency): string {
  const config = getCurrencyConfig(currency);
  const divisor = Math.pow(10, config.decimalPlaces);
  const amount = amountInSmallestUnit / divisor;
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    // Use the resolved config's code (getCurrencyConfig falls back to a valid
    // currency) - never the raw param, which could be an empty/unknown string
    // (e.g. a stale persisted value) and would throw "Invalid currency code".
    currency: config.code.toUpperCase(),
    minimumFractionDigits: config.decimalPlaces,
    maximumFractionDigits: config.decimalPlaces,
  }).format(amount);
}

/**
 * Converts a price from USD cents to the smallest unit of the target currency
 * using the provided exchange rate (1 USD = `rate` of target currency).
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