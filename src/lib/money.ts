import { VALID_CURRENCIES, type Currency } from "@/lib/currency-config";
import { getCurrencyConfig } from "@/lib/currency";

/** rates[code] = how many units of that currency per 1 USD. USD is always 1. */
export type CurrencyRates = Record<string, number>;

/**
 * One money value, stored once per supported currency.
 *
 * The whole point: the amount a human typed is kept EXACTLY, in the currency
 * they typed it in, and is never recomputed from an exchange rate again. The
 * other currencies are derived once, rounded to something a shop would actually
 * charge, and then frozen. Nothing on the display path touches a rate, so a
 * price cannot drift between saving it and reading it back - and it cannot move
 * on its own when the daily rate updates.
 *
 * Every amount is an integer in that currency's minor unit per ISO 4217
 * (cents, para). `amounts` is partial only in the degraded case where a rate was
 * missing when the set was written; `usd` is always present and is what the
 * indexed mirror columns hold.
 */
export type MoneySet = {
  /** Currency the value was first entered in. An editor reopens in this one. */
  primary: Currency;
  /** Exact integer minor units per currency. */
  amounts: Partial<Record<Currency, number>>;
  /** Currencies whose amount a human typed. Always contains `primary`. */
  authored: Currency[];
  /** Rate snapshot used the last time the derived entries were computed. */
  rates: CurrencyRates;
};

/** Thrown when a set cannot be built because the rate it needs is unavailable.
 *  Callers surface this instead of storing a silently wrong price. */
export class MissingRateError extends Error {
  constructor(public readonly currency: Currency) {
    super(`No exchange rate available for "${currency}"`);
    this.name = "MissingRateError";
  }
}

/** Units of `currency` per 1 USD, or null when we have no usable rate. */
function rateOf(rates: CurrencyRates, currency: Currency): number | null {
  if (currency === "usd") return 1;
  const raw = Number(rates?.[currency]);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

/** Rounds a derived amount to that currency's smallest unit (`derivedStep`, one
 *  minor unit everywhere). Authored amounts are never passed through this - what
 *  the seller typed is what is stored. */
function roundDerived(minor: number, currency: Currency): number {
  const step = getCurrencyConfig(currency).derivedStep;
  return Math.round(minor / step) * step;
}

/**
 * Converts an exact amount in one currency into another currency's minor units.
 * Returns null when either leg has no rate, so the caller can decide whether to
 * fail the write or fall back on the read path.
 */
export function deriveMinor(
  fromMinor: number,
  from: Currency,
  to: Currency,
  rates: CurrencyRates,
): number | null {
  if (from === to) return fromMinor;
  const fromRate = rateOf(rates, from);
  const toRate = rateOf(rates, to);
  if (fromRate === null || toRate === null) return null;

  const fromScale = 10 ** getCurrencyConfig(from).decimalPlaces;
  const toScale = 10 ** getCurrencyConfig(to).decimalPlaces;
  const usd = fromMinor / fromScale / fromRate;
  return roundDerived(usd * toRate * toScale, to);
}

/**
 * Builds a set from an amount a human typed. The typed currency is authored and
 * kept verbatim; every other supported currency is derived and rounded.
 *
 * @throws MissingRateError when the typed currency has no rate - without it the
 *   USD mirror would be wrong, which would corrupt sorting, price filters,
 *   coupon minimums and free-shipping thresholds.
 */
export function authorMoney(
  minor: number,
  primary: Currency,
  rates: CurrencyRates,
): MoneySet {
  if (rateOf(rates, primary) === null) throw new MissingRateError(primary);
  const amount = Math.round(minor);
  const amounts: Partial<Record<Currency, number>> = { [primary]: amount };
  for (const c of VALID_CURRENCIES) {
    if (c === primary) continue;
    const derived = deriveMinor(amount, primary, c, rates);
    if (derived !== null) amounts[c] = derived;
  }
  return { primary, amounts, authored: [primary], rates: { ...rates } };
}

/**
 * Pins one currency to an exact amount (the "fixed price for this market"
 * override). Setting the primary currency re-derives every entry that is still
 * derived; setting another currency only pins that one.
 */
export function setAuthoredAmount(
  set: MoneySet,
  currency: Currency,
  minor: number,
  rates: CurrencyRates,
): MoneySet {
  const amount = Math.round(minor);
  const authored = set.authored.includes(currency)
    ? set.authored
    : [...set.authored, currency];
  const next: MoneySet = {
    ...set,
    amounts: { ...set.amounts, [currency]: amount },
    authored,
    rates: { ...rates },
  };
  return currency === set.primary ? refreshDerived(next, rates) : next;
}

/** Drops a per-currency override, putting that currency back on the derived
 *  path from `primary`. */
export function clearAuthoredAmount(
  set: MoneySet,
  currency: Currency,
  rates: CurrencyRates,
): MoneySet {
  if (currency === set.primary) return set;
  const next: MoneySet = {
    ...set,
    authored: set.authored.filter((c) => c !== currency),
  };
  return refreshDerived(next, rates);
}

/** Recomputes every non-authored entry from `primary` at the given rates.
 *  Deliberate action only - never called on the read path, because that is
 *  exactly the drift this module exists to prevent. */
export function refreshDerived(set: MoneySet, rates: CurrencyRates): MoneySet {
  const base = set.amounts[set.primary];
  if (base == null) return set;
  const amounts: Partial<Record<Currency, number>> = {};
  for (const c of VALID_CURRENCIES) {
    if (set.authored.includes(c)) {
      const kept = set.amounts[c];
      if (kept != null) amounts[c] = kept;
      continue;
    }
    const derived = deriveMinor(base, set.primary, c, rates);
    if (derived !== null) amounts[c] = derived;
  }
  return { ...set, amounts, rates: { ...rates } };
}

/**
 * The amount to show, in `currency`'s minor units.
 *
 * The stored entry is returned as-is - no rate is involved, which is what makes
 * a displayed price stable. `liveRates` is only the degraded fallback for a set
 * written while a rate was missing, or for a currency added after the set was
 * last saved; it derives from the USD mirror so something sensible still shows.
 */
export function moneyIn(
  set: MoneySet,
  currency: Currency,
  liveRates?: CurrencyRates,
): number {
  const stored = set.amounts[currency];
  if (stored != null) return stored;
  const usd = set.amounts.usd;
  if (usd == null) return 0;
  return deriveMinor(usd, "usd", currency, liveRates ?? set.rates) ?? 0;
}

/** The USD-cent mirror, i.e. what the indexed scalar column holds. */
export function moneyUsdCents(set: MoneySet): number {
  return set.amounts.usd ?? 0;
}

/** True when this currency's amount was typed rather than derived. */
export function isAuthoredIn(set: MoneySet, currency: Currency): boolean {
  return set.authored.includes(currency);
}

/**
 * Reads a `MoneySet` back out of a Json column.
 *
 * Tolerant on purpose: rows written before this module existed, or by an older
 * deploy, hold no JSON at all. `fallbackUsdCents` (the mirror column, which is
 * always present) reconstructs a USD-primary set so nothing renders as 0.
 */
export function parseMoney(
  value: unknown,
  fallbackUsdCents: number | null | undefined,
): MoneySet | null {
  const isCurrency = (c: unknown): c is Currency =>
    typeof c === "string" && (VALID_CURRENCIES as readonly string[]).includes(c);

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const raw = value as Record<string, unknown>;
    const rawAmounts = raw.amounts;
    if (isCurrency(raw.primary) && rawAmounts && typeof rawAmounts === "object") {
      const primary = raw.primary;
      const amounts: Partial<Record<Currency, number>> = {};
      for (const c of VALID_CURRENCIES) {
        const n = Number((rawAmounts as Record<string, unknown>)[c]);
        if (Number.isFinite(n)) amounts[c] = Math.round(n);
      }
      if (amounts[primary] != null) {
        const authored = Array.isArray(raw.authored)
          ? raw.authored.filter(isCurrency)
          : [];
        return {
          primary,
          amounts,
          authored: authored.includes(primary) ? authored : [primary, ...authored],
          rates:
            raw.rates && typeof raw.rates === "object"
              ? (raw.rates as CurrencyRates)
              : { usd: 1 },
        };
      }
    }
  }

  if (fallbackUsdCents == null) return null;
  return {
    primary: "usd",
    amounts: { usd: Math.round(fallbackUsdCents) },
    authored: ["usd"],
    rates: { usd: 1 },
  };
}

/**
 * The wire/column shape of a set. Spelled out with concrete types rather than
 * `unknown` so it satisfies Prisma's `InputJsonValue` directly, and so this
 * module stays free of any Prisma import (it is bundled into client components
 * too, via MoneyField).
 */
export type MoneySetJson = {
  primary: string;
  amounts: Record<string, number>;
  authored: string[];
  rates: Record<string, number>;
};

/** Prisma Json columns take plain objects; this is the explicit boundary. */
export function serializeMoney(set: MoneySet): MoneySetJson {
  const amounts: Record<string, number> = {};
  for (const [code, amount] of Object.entries(set.amounts)) {
    if (amount != null) amounts[code] = amount;
  }
  return {
    primary: set.primary,
    amounts,
    authored: [...set.authored],
    rates: { ...set.rates },
  };
}

/**
 * Minor units to the decimal a form input shows, in that currency's own scale.
 * Replaces the USD-only `centsToDecimal` at every call site that deals with a
 * currency other than USD.
 */
export function minorToDecimal(minor: number, currency: Currency): number {
  return minor / 10 ** getCurrencyConfig(currency).decimalPlaces;
}

/** The inverse. Rounds, so a float typed into an input cannot leak a fraction
 *  of a minor unit into storage. */
export function decimalToMinor(decimal: number, currency: Currency): number {
  return Math.round(decimal * 10 ** getCurrencyConfig(currency).decimalPlaces);
}

/**
 * Projects a row's raw money columns into the pair the UI consumes: the parsed
 * `MoneySet` for display, and the USD-cent mirror as a plain number for sorting
 * and filters. Used by every product serializer so no read path can forget one
 * half of the pair.
 */
export function serializeMoneyFields(row: {
  price: number;
  priceMoney?: unknown;
  compareAtPrice: number | null;
  compareAtPriceMoney?: unknown;
  costPrice: number | null;
  costPriceMoney?: unknown;
}) {
  return {
    price: Number(row.price),
    priceMoney: parseMoney(row.priceMoney, Number(row.price)),
    compareAtPrice: row.compareAtPrice != null ? Number(row.compareAtPrice) : null,
    compareAtPriceMoney: parseMoney(row.compareAtPriceMoney, row.compareAtPrice),
    costPrice: row.costPrice != null ? Number(row.costPrice) : null,
    costPriceMoney: parseMoney(row.costPriceMoney, row.costPrice),
  };
}
