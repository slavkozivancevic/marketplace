import { VALID_CURRENCIES, type Currency } from "@/lib/currency-config";
import type { MoneySet } from "@/lib/money";
import { PRICE_REFERENCE_LOOKBACK_DAYS, type EngineRule } from "../schema/priceRules";
import { applyAdjustment } from "./adjust";

/** One entry of the Omnibus ledger (`PricePoint`). */
export type LedgerPoint = { priceMoney: MoneySet; startedAt: Date; endedAt: Date | null };

export type RollInput = {
  /** The target's own base price and seller-typed compare-at. */
  base: { priceMoney: MoneySet; compareAtMoney: MoneySet | null };
  /** The window covering `now`, with its rule, or null. */
  active: { rule: EngineRule; startsAt: Date; endsAt: Date } | null;
  /** Start of the next window after `now`, or null when none is materialised. */
  nextStart: Date | null;
  /** Ledger points of this target that may overlap the lookback. */
  points: LedgerPoint[];
};

/** What the read-model columns hold after a roll. */
export type RolledState = {
  priceMoney: MoneySet;
  compareAtMoney: MoneySet | null;
  ruleId: string | null;
  ruleLabel: string | null;
  /** When this state stops being true; null = until something changes. */
  until: Date | null;
  /** Start of the window behind `ruleId`; null whenever `ruleId` is. */
  since: Date | null;
};

const DAY_MS = 86_400_000;

/**
 * The effective price of one target, right now.
 *
 * - No active window: the base price and the seller's own compare-at, exactly
 *   what the storefront showed before dynamic pricing existed.
 * - Active window: the rule's price from the CURRENT base (so a base edit never
 *   needs a window rebuild). A rule whose result is not sellable falls back to
 *   the base price rather than inventing one.
 * - Struck-through price under a window (EU Omnibus): the lowest price the
 *   target actually had in the 30 days BEFORE this reduction started. It is
 *   fixed for the whole window, so it never needs re-rolling mid-promo. It is
 *   shown only when the current price is strictly below it in every currency;
 *   otherwise there is no strike-through at all - which is why a weekly promo
 *   loses its strike once last week's promo price is inside the 30 days.
 */
export function rollTarget(input: RollInput): RolledState {
  const { base, active, nextStart } = input;

  if (!active) {
    return {
      priceMoney: base.priceMoney,
      compareAtMoney: base.compareAtMoney,
      ruleId: null,
      ruleLabel: null,
      until: nextStart,
      since: null,
    };
  }

  const until = earliest(active.endsAt, nextStart);
  const ruled = applyAdjustment(base.priceMoney, active.rule);
  if (!ruled) {
    return {
      priceMoney: base.priceMoney,
      compareAtMoney: base.compareAtMoney,
      ruleId: null,
      ruleLabel: null,
      until,
      since: null,
    };
  }

  const reference = lowestBefore(input.points, active.startsAt, base.priceMoney);
  return {
    priceMoney: ruled,
    compareAtMoney: isStrictlyBelow(ruled, reference) ? reference : null,
    ruleId: active.rule.id,
    ruleLabel: active.rule.name,
    until,
    since: active.startsAt,
  };
}

/**
 * Per-currency minimum over the ledger points that overlap
 * `[reductionStart - 30 days, reductionStart)`. `fallback` (the base price)
 * only matters for a target with no ledger history at all.
 */
export function lowestBefore(points: LedgerPoint[], reductionStart: Date, fallback: MoneySet): MoneySet {
  const from = reductionStart.getTime() - PRICE_REFERENCE_LOOKBACK_DAYS * DAY_MS;
  const to = reductionStart.getTime();
  const inRange = points.filter(
    (p) => p.startedAt.getTime() < to && (p.endedAt === null || p.endedAt.getTime() > from),
  );
  if (inRange.length === 0) return fallback;

  const amounts: Partial<Record<Currency, number>> = {};
  for (const c of VALID_CURRENCIES) {
    for (const p of inRange) {
      const a = p.priceMoney.amounts[c];
      if (a == null) continue;
      const current = amounts[c];
      amounts[c] = current == null ? a : Math.min(current, a);
    }
  }
  const first = inRange[0].priceMoney;
  return { ...first, amounts, authored: [...first.authored], rates: { ...first.rates } };
}

/** True when `current` is below `reference` in every currency both carry. */
export function isStrictlyBelow(current: MoneySet, reference: MoneySet): boolean {
  let compared = 0;
  for (const c of VALID_CURRENCIES) {
    const a = current.amounts[c];
    const r = reference.amounts[c];
    if (a == null || r == null) continue;
    if (a >= r) return false;
    compared++;
  }
  return compared > 0;
}

function earliest(a: Date, b: Date | null): Date {
  return b !== null && b < a ? b : a;
}
