import { cacheLife } from "next/cache";
import { parseMoney, serializeMoneyFields, type MoneySet } from "@/lib/money";
import type { EffectivePriceKey } from "@/types/types";
import type { MarketRule, MarketRules, SchedulePricing } from "../engine/market";

/** The dynamic-pricing read model as Prisma returns it. */
export type EffectiveColumns = {
  effectivePrice: number;
  effectivePriceMoney: unknown;
  effectiveCompareAtPrice: number | null;
  effectiveCompareAtPriceMoney: unknown;
  effectiveRuleId: string | null;
  effectiveRuleLabel: string | null;
  effectiveUntil: Date | null;
};

/**
 * The money fields a STOREFRONT payload carries: the price the buyer is shown
 * and charged right now, under the same `price` / `priceMoney` /
 * `compareAtPrice` / `compareAtPriceMoney` names every card, page and cart
 * already reads - so none of them needs to know dynamic pricing exists.
 *
 * Admin and seller screens do NOT use this: they manage the base price and keep
 * calling `serializeMoneyFields` on the base columns.
 */
export function publicMoneyFields(
  row: EffectiveColumns & { costPrice: number | null; costPriceMoney?: unknown },
) {
  return serializeMoneyFields({
    price: row.effectivePrice,
    priceMoney: row.effectivePriceMoney,
    compareAtPrice: row.effectiveCompareAtPrice,
    compareAtPriceMoney: row.effectiveCompareAtPriceMoney,
    costPrice: row.costPrice,
    costPriceMoney: row.costPriceMoney,
  });
}

type CompareAtSource = { effectiveRuleId: string | null; effectiveCompareAtPriceMoney: unknown };

/**
 * The struck-through price to show for a variant.
 *
 * A variant with no "was" price of its own inherits the product's - the rule
 * the product page and quick view apply, so picking a variant never drops the
 * sale badge the buyer clicked on. Under a price rule that inheritance must
 * stop: the variant's strike-through is then its own Omnibus reference (the
 * lowest price of the 30 days before the promo), and "none" is a real answer
 * that a product-level price must not fill in.
 */
export function variantCompareAt(variant: CompareAtSource, product: CompareAtSource): MoneySet | null {
  const own = parseMoney(variant.effectiveCompareAtPriceMoney);
  if (own || variant.effectiveRuleId !== null) return own;
  return product.effectiveRuleId === null ? parseMoney(product.effectiveCompareAtPriceMoney) : null;
}

/**
 * `publicMoneyFields` for a variant inside a product payload.
 *
 * The storefront inherits the product's compare-at whenever a variant's is
 * null (see `variantCompareAt`). Where inheriting would show a strike-through
 * the rules forbid, the variant's compare-at is set to its own price instead:
 * an equal price is not a reduction - every surface requires "was > now" - and
 * a non-null value stops the inheritance.
 */
export function publicVariantMoneyFields(
  variant: EffectiveColumns & { costPrice: number | null; costPriceMoney?: unknown },
  product: CompareAtSource,
) {
  const fields = publicMoneyFields(variant);
  const shown = variantCompareAt(variant, product);
  const wouldInherit = fields.compareAtPriceMoney === null && parseMoney(product.effectiveCompareAtPriceMoney) !== null;
  if (shown === null && wouldInherit) {
    return { ...fields, compareAtPrice: fields.price, compareAtPriceMoney: fields.priceMoney };
  }
  return fields;
}

const EFFECTIVE_KEYS = [
  "effectivePrice",
  "effectivePriceMoney",
  "effectiveCompareAtPrice",
  "effectiveCompareAtPriceMoney",
  "effectiveRuleId",
  "effectiveRuleLabel",
  "effectiveUntil",
  "effectiveSince",
] as const satisfies readonly EffectivePriceKey[];

export function schedulePricing(row: { effectiveRuleId: string | null; effectiveSince: Date | null }): SchedulePricing {
  return row.effectiveRuleId === null
    ? { ruleId: null, since: null }
    : { ruleId: row.effectiveRuleId, since: row.effectiveSince };
}

/**
 * The market rules a storefront payload carries: active REGION rules only,
 * product-level and every variant's, compact. Viewer-neutral on purpose - the
 * cached payload is the same for every buyer and `applyMarket` picks per
 * viewer, the way currency is applied per viewer to a currency-neutral payload.
 */
export const marketRulesInclude = {
  priceRules: {
    where: { kind: "REGION", active: true },
    select: {
      id: true,
      name: true,
      variantId: true,
      marketId: true,
      countryCode: true,
      adjustment: true,
      percentBps: true,
      amountMoney: true,
      priority: true,
      createdAt: true,
    },
  },
} as const;

type MarketRuleRow = Omit<MarketRule, "amountMoney"> & { amountMoney: unknown };

export function marketRulesOf(row: {
  priceRules: readonly MarketRuleRow[];
  marketRuleClocks: unknown;
}): MarketRules {
  return {
    rules: row.priceRules.map((r) => ({ ...r, amountMoney: parseMoney(r.amountMoney) })),
    clocks: parseClocks(row.marketRuleClocks),
  };
}

/**
 * `Product.marketRuleClocks` as written by `touchMarketRules`: target key ->
 * ISO timestamp. Anything else in the JSON is dropped rather than trusted.
 */
export function parseClocks(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string" && !Number.isNaN(Date.parse(value))) out[key] = value;
  }
  return out;
}

/** Drops the read-model columns so they never reach a client payload. */
export function withoutEffective<T extends EffectiveColumns>(row: T): Omit<T, EffectivePriceKey> {
  const out: Record<string, unknown> = { ...row };
  for (const key of EFFECTIVE_KEYS) delete out[key];
  return out as Omit<T, EffectivePriceKey>;
}

/** Seconds until the earliest `effectiveUntil` among `rows`, or null if none. */
export function secondsUntilNextPriceChange(
  rows: readonly { effectiveUntil: Date | null }[],
  now: number = Date.now(),
): number | null {
  let earliest: number | null = null;
  for (const r of rows) {
    if (!r.effectiveUntil) continue;
    const t = r.effectiveUntil.getTime();
    if (earliest === null || t < earliest) earliest = t;
  }
  if (earliest === null) return null;
  // At least 2s: `revalidate` must stay below `expire`, and a boundary that is
  // already due is rolled by the next reader anyway.
  return Math.max(2, Math.ceil((earliest - now) / 1000));
}

/**
 * Makes a `"use cache"` reader expire exactly when the next price it returned
 * changes, so the first request after 18:00 recomputes instead of serving the
 * 17:59 price. Rows with no upcoming change leave the reader's lifetime as it
 * was. Call it only inside a `"use cache"` scope, after the rows are read.
 */
export function expireAtNextPriceChange(rows: readonly { effectiveUntil: Date | null }[]): void {
  const seconds = secondsUntilNextPriceChange(rows);
  if (seconds === null) return;
  cacheLife({
    // The client router cache must not keep the old price past the boundary.
    stale: Math.min(30, seconds - 1),
    revalidate: seconds - 1,
    expire: seconds,
  });
}
