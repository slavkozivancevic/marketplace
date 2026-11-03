import { formatPrice } from "@/lib/currency";
import { VALID_CURRENCIES, type Currency } from "@/lib/currency-config";
import { intlLocale } from "@/lib/i18n/dateLocale";

/**
 * Diff keys that hold money, always in the smallest unit (cents / para) as the
 * ledger stores it. Rendered raw they read as millions ("Amount: 4690965"), so
 * the audit log formats them like every other price in the app.
 */
export const AUDIT_MONEY_KEYS = new Set(["amount", "codNetted", "fee", "settled", "paid"]);

function asCurrency(value: unknown): Currency | null {
  const code = typeof value === "string" ? value.toLowerCase() : "";
  return (VALID_CURRENCIES as readonly string[]).includes(code) ? (code as Currency) : null;
}

/**
 * One money value of an audit diff, in the reader's locale: "46.909,65 RSD",
 * "-441,32 RSD". `currency` is the entry's own `currency` field. Entries
 * recorded before every money diff carried one still come out as a decimal
 * amount ("46.909,65") - never the raw integer of minor units.
 */
export function formatAuditMoney(minor: number, currency: unknown, locale: string): string {
  const code = asCurrency(currency);
  const sign = minor < 0 ? "-" : "";
  if (code) return sign + formatPrice(Math.abs(minor), code, locale);
  return (
    sign +
    new Intl.NumberFormat(intlLocale(locale), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: "always",
    }).format(Math.abs(minor) / 100)
  );
}

/**
 * Whether the entry's `currency` field still needs its own "Currency: rsd"
 * item. Not once a money value has been printed with it - it would only say
 * again what the amount already shows.
 */
export function currencyShownByMoney(diff: Record<string, unknown>): boolean {
  return (
    asCurrency(diff.currency) !== null &&
    Object.entries(diff).some(([k, v]) => AUDIT_MONEY_KEYS.has(k) && typeof v === "number")
  );
}
