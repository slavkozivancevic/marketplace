import type { MoneySet } from "@/lib/money";
import { PRICE_REFERENCE_LOOKBACK_DAYS, type EngineRule } from "../schema/priceRules";
import { applyAdjustment } from "./adjust";
import { compareRules } from "./precedence";
import { isStrictlyBelow } from "./roll";

const DAY_MS = 86_400_000;

/** A timestamp as it arrives: a Date from the server, an ISO string through JSON. */
type Instant = Date | string;

/**
 * An active market (REGION) rule as a storefront payload carries it. Inactive
 * rules and schedule rules never reach a payload, so neither field is here.
 */
export type MarketRule = Pick<
  EngineRule,
  "id" | "name" | "variantId" | "adjustment" | "percentBps" | "amountMoney" | "priority"
> & {
  marketId: string | null;
  countryCode: string | null;
  createdAt: Instant;
};

/** Who is looking: their country, the market it falls into, and the map's age. */
export type MarketViewer = {
  /** ISO alpha-2, or null when no country is known. */
  country: string | null;
  /** The viewer's market - the default one when the country maps nowhere. */
  marketId: string | null;
  /** When the viewer's country last changed market; null if it never did, or no country is known. */
  countryMovedAt: Instant | null;
};

/** The viewer-neutral price a payload carries: the read-model columns. */
export type NeutralPrice = {
  priceMoney: MoneySet;
  compareAtMoney: MoneySet | null;
  /** What produced `priceMoney`; a rule here means `compareAtMoney` is an Omnibus reference. */
  schedule: SchedulePricing;
};

/**
 * Which schedule rule produced the price a payload carries, and since when -
 * all the market layer needs to know about it. A set `ruleId` means the
 * payload's compare-at is an Omnibus reference, not the seller's own; `since`
 * anchors that reference's 30-day lookback.
 */
export type SchedulePricing = { ruleId: string | null; since: Instant | null };

/**
 * A product's market rules plus when the rules aimed at each target last
 * changed, keyed by `marketClockKey` / `countryClockKey`. Empty when the
 * product never had a market rule.
 */
export type MarketRules = {
  rules: readonly MarketRule[];
  clocks: Readonly<Record<string, Instant>>;
};

/** The clock key of rules aimed at a market. */
export const marketClockKey = (marketId: string) => `m:${marketId}`;
/** The clock key of rules aimed at a country. */
export const countryClockKey = (country: string) => `c:${country}`;

/** The clock key a market rule's changes are recorded under, or null for a rule with no target. */
export function ruleClockKey(rule: { countryCode: string | null; marketId: string | null }): string | null {
  if (rule.countryCode) return countryClockKey(rule.countryCode);
  if (rule.marketId) return marketClockKey(rule.marketId);
  return null;
}

export type MarketPrice = {
  priceMoney: MoneySet;
  compareAtMoney: MoneySet | null;
  /** The market rule that changed the price, or null when the viewer pays the neutral price. */
  marketRule: { id: string; name: string } | null;
};

const ms = (t: Instant) => (typeof t === "string" ? Date.parse(t) : t.getTime());

/**
 * The market rule that applies to a target for a viewer, or null.
 *
 * Candidates: product-level rules (which apply to every variant, each from its
 * own price) and rules on this exact variant, aimed at the viewer's country or
 * at their market. `compareRules` ranks them - variant over product, country
 * over market, priority, createdAt, id - and the first whose result is
 * sellable wins; an unsellable rule is skipped, as `buildWindows` skips one.
 */
export function pickMarketRule(
  rules: readonly MarketRule[],
  variantId: string | null,
  base: MoneySet,
  viewer: MarketViewer,
): { rule: MarketRule; priceMoney: MoneySet } | null {
  const ranked = rules
    .filter(
      (r) =>
        (r.variantId === null || r.variantId === variantId) &&
        ((r.countryCode !== null && r.countryCode === viewer.country) ||
          (r.marketId !== null && r.marketId === viewer.marketId)),
    )
    .map((r) => ({ r, ranked: { ...r, createdAt: new Date(ms(r.createdAt)) } }))
    .sort((a, b) => compareRules(a.ranked, b.ranked));

  for (const { r } of ranked) {
    const priceMoney = applyAdjustment(base, r);
    if (priceMoney) return { rule: r, priceMoney };
  }
  return null;
}

/**
 * The viewer's price: the market rule applied ON TOP of the neutral price -
 * which already has any schedule promo in it, so a "+10% Eurozone" rule and a
 * "Black Friday -20%" rule both reach a Eurozone buyer.
 *
 * The struck-through price follows the rule that produced it:
 * - A seller-typed compare-at (no schedule window) moves with the price under a
 *   percent or amount-off rule, and is kept only while still above it.
 * - An Omnibus reference (a schedule window is active) is the lowest price of
 *   the 30 days before the window. Percent and amount-off are monotonic, also
 *   after rounding down, so in a market that lowest price IS the rule applied
 *   to the default lowest price - provided the market's prices over those 30
 *   days were the default ones adjusted by these same rules. If, in that
 *   period, a rule of this product aimed at the viewer's market or country
 *   changed, or the viewer's country changed market, nobody can say what their
 *   lowest price was, so no reduction is announced to them. That check applies
 *   even when no rule matches now: a rule deleted last week may have priced
 *   this viewer lower. Changes aimed elsewhere never priced this viewer, so a
 *   Germany rule edit leaves a Serbian buyer's reference alone.
 * - A fixed market price does not move with anything, so it is never a
 *   reduction and carries no strike-through.
 */
export function applyMarket(
  price: NeutralPrice,
  variantId: string | null,
  market: MarketRules,
  viewer: MarketViewer,
): MarketPrice {
  const referenceTrusted =
    price.schedule.ruleId === null || marketHistoryStable(price.schedule.since, market, viewer);

  const picked = pickMarketRule(market.rules, variantId, price.priceMoney, viewer);
  if (!picked) {
    return {
      priceMoney: price.priceMoney,
      compareAtMoney: referenceTrusted ? price.compareAtMoney : null,
      marketRule: null,
    };
  }

  const { rule, priceMoney } = picked;
  let compareAtMoney: MoneySet | null = null;
  if (rule.adjustment !== "FIXED_PRICE" && price.compareAtMoney && referenceTrusted) {
    const was = applyAdjustment(price.compareAtMoney, rule);
    if (was && isStrictlyBelow(priceMoney, was)) compareAtMoney = was;
  }
  return { priceMoney, compareAtMoney, marketRule: { id: rule.id, name: rule.name } };
}

/**
 * Whether the viewer's market prices over the Omnibus lookback before `since`
 * were the default ones adjusted by the market rules as they stand now.
 *
 * A viewer's market price only ever depended on rules aimed at their market or
 * their country, so only those targets' clocks count - plus a move of their
 * country, which changed their market and with it which rules priced them. A
 * product that never had a market rule has nothing to drift, so a move cannot
 * matter to it.
 */
function marketHistoryStable(since: Instant | null, market: MarketRules, viewer: MarketViewer): boolean {
  if (Object.keys(market.clocks).length === 0) return true;
  if (since === null) return false;
  const from = ms(since) - PRICE_REFERENCE_LOOKBACK_DAYS * DAY_MS;
  const changedSince = (t: Instant | null | undefined) => t != null && ms(t) > from;
  if (viewer.marketId !== null && changedSince(market.clocks[marketClockKey(viewer.marketId)])) return false;
  if (viewer.country !== null && changedSince(market.clocks[countryClockKey(viewer.country)])) return false;
  return !changedSince(viewer.countryMovedAt);
}
