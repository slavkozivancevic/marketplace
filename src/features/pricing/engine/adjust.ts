import { VALID_CURRENCIES, type Currency } from "@/lib/currency-config";
import type { MoneySet } from "@/lib/money";
import type { EngineRule } from "../schema/priceRules";

type Adjustment = Pick<EngineRule, "adjustment" | "percentBps" | "amountMoney">;

/**
 * The price a rule produces from a base price, as a MoneySet.
 *
 * Every currency is computed from its OWN stored amount. No exchange rate is
 * read and nothing is re-derived: a typed 1.000 RSD minus 20% is exactly
 * 800 RSD, and a rule cannot reintroduce the drift MoneySet exists to prevent.
 * Results round DOWN to the minor unit, so the buyer never pays more than the
 * percentage promises - a discount is at least the advertised one and a markup
 * at most the advertised one.
 *
 * Returns null when the result is not a sellable price in every currency
 * (zero, negative, or no USD amount for the mirror). Validation already refuses
 * such rules; this is the second line, and the caller skips the rule.
 */
export function applyAdjustment(base: MoneySet, rule: Adjustment): MoneySet | null {
  let result: MoneySet | null;
  switch (rule.adjustment) {
    case "PERCENT":
      result = rule.percentBps === null ? null : applyPercent(base, rule.percentBps);
      break;
    case "AMOUNT_OFF":
      result = rule.amountMoney === null ? null : subtract(base, rule.amountMoney);
      break;
    case "FIXED_PRICE":
      result = rule.amountMoney === null ? null : copySet(rule.amountMoney);
      break;
  }
  return result && isSellable(result) ? result : null;
}

function applyPercent(base: MoneySet, bps: number): MoneySet {
  const factor = 10_000 + bps;
  // Integer numerator over 10 000: exact in a double, so the floor is exact too.
  return mapAmounts(base, (amount) => Math.floor((amount * factor) / 10_000));
}

function subtract(base: MoneySet, off: MoneySet): MoneySet {
  const amounts: Partial<Record<Currency, number>> = {};
  for (const c of VALID_CURRENCIES) {
    const a = base.amounts[c];
    const b = off.amounts[c];
    // A currency either side lacks stays missing, exactly as in the base set;
    // `moneyIn` already handles that degraded case on the read path.
    if (a != null && b != null) amounts[c] = a - b;
  }
  return { ...base, amounts, authored: [...base.authored], rates: { ...base.rates } };
}

function mapAmounts(set: MoneySet, fn: (amount: number) => number): MoneySet {
  const amounts: Partial<Record<Currency, number>> = {};
  for (const c of VALID_CURRENCIES) {
    const a = set.amounts[c];
    if (a != null) amounts[c] = fn(a);
  }
  return { ...set, amounts, authored: [...set.authored], rates: { ...set.rates } };
}

function copySet(set: MoneySet): MoneySet {
  return mapAmounts(set, (a) => a);
}

function isSellable(set: MoneySet): boolean {
  if (set.amounts.usd == null) return false;
  return VALID_CURRENCIES.every((c) => {
    const a = set.amounts[c];
    return a == null || a > 0;
  });
}
