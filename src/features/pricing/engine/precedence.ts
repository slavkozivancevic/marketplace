import type { EngineRule } from "../schema/priceRules";

type Ranked = Pick<
  EngineRule,
  "id" | "variantId" | "priority" | "createdAt" | "countryCode" | "marketId"
>;

/**
 * Sort comparator: the rule that wins sorts FIRST.
 *
 * The order is total, so exactly one rule wins any overlap:
 * 1. variant over product - a price set on one variant is a deliberate
 *    decision about that item, and a broad product rule must not override it;
 * 2. country over market over default (REGION rules; schedule rules tie here);
 * 3. higher `priority`;
 * 4. later `createdAt`;
 * 5. `id`, so two rules created in the same millisecond still never tie.
 */
export function compareRules(a: Ranked, b: Ranked): number {
  return (
    scopeRank(b) - scopeRank(a) ||
    geoRank(b) - geoRank(a) ||
    b.priority - a.priority ||
    b.createdAt.getTime() - a.createdAt.getTime() ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

function scopeRank(r: Ranked): number {
  return r.variantId === null ? 0 : 1;
}

function geoRank(r: Ranked): number {
  if (r.countryCode) return 2;
  if (r.marketId) return 1;
  return 0;
}
