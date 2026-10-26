import { moneyUsdCents, type MoneySet } from "@/lib/money";
import type { EngineRule } from "../schema/priceRules";
import { applyAdjustment } from "./adjust";
import { expandOccurrences, type Interval } from "./occurrences";
import { compareRules } from "./precedence";

/** What a price applies to: a product, or one of its variants. */
export type PriceTarget = {
  productId: string;
  variantId: string | null;
  /** The base price of THIS target - a variant's own price, not the product's. */
  baseMoney: MoneySet;
};

/**
 * One stretch of time during which one rule sets the price.
 *
 * `price` is the USD-cent mirror of `priceMoney`, produced together so the two
 * can never disagree - the same pairing every money column keeps.
 */
export type PriceWindowDraft = {
  productId: string;
  variantId: string | null;
  ruleId: string;
  ruleLabel: string;
  startsAt: Date;
  endsAt: Date;
  priceMoney: MoneySet;
  price: number;
};

/**
 * The windows a target's schedule rules produce over `[from, to)`.
 *
 * The output never overlaps: wherever rules overlap, `compareRules` picks one,
 * so the read path can take "the window covering NOW()" without ranking
 * anything itself. Adjacent stretches won by the same rule are merged. A rule
 * whose price would not be sellable is skipped, not clamped to something.
 *
 * Pure and deterministic: the same input always yields the same list, which is
 * what makes regenerating windows idempotent.
 */
export function buildWindows(
  target: PriceTarget,
  rules: EngineRule[],
  from: Date,
  to: Date,
): PriceWindowDraft[] {
  type Candidate = { rule: EngineRule; priceMoney: MoneySet; intervals: Interval[] };

  const candidates: Candidate[] = [];
  for (const rule of rules) {
    if (!appliesTo(rule, target)) continue;
    const priceMoney = applyAdjustment(target.baseMoney, rule);
    if (!priceMoney) continue;
    const intervals = expandOccurrences(rule, from, to);
    if (intervals.length > 0) candidates.push({ rule, priceMoney, intervals });
  }
  if (candidates.length === 0) return [];

  const boundaries = [
    ...new Set(
      candidates.flatMap((c) => c.intervals.flatMap((i) => [i.start.getTime(), i.end.getTime()])),
    ),
  ].sort((a, b) => a - b);

  const out: PriceWindowDraft[] = [];
  for (let k = 0; k < boundaries.length - 1; k++) {
    const segStart = boundaries[k];
    const segEnd = boundaries[k + 1];
    const winner = candidates
      .filter((c) =>
        c.intervals.some((i) => i.start.getTime() <= segStart && segStart < i.end.getTime()),
      )
      .sort((a, b) => compareRules(a.rule, b.rule))[0];
    if (!winner) continue;

    const prev = out[out.length - 1];
    if (prev && prev.ruleId === winner.rule.id && prev.endsAt.getTime() === segStart) {
      prev.endsAt = new Date(segEnd);
      continue;
    }
    out.push({
      productId: target.productId,
      variantId: target.variantId,
      ruleId: winner.rule.id,
      ruleLabel: winner.rule.name,
      startsAt: new Date(segStart),
      endsAt: new Date(segEnd),
      priceMoney: winner.priceMoney,
      price: moneyUsdCents(winner.priceMoney),
    });
  }
  return out;
}

/**
 * A product-level rule applies to the product and to every one of its
 * variants (each from its own base price); a variant-level rule only to that
 * variant. Region rules are resolved per viewer at read time, never here.
 */
function appliesTo(rule: EngineRule, target: PriceTarget): boolean {
  return (
    rule.kind === "SCHEDULE" &&
    rule.active &&
    rule.productId === target.productId &&
    (rule.variantId === null || rule.variantId === target.variantId)
  );
}
