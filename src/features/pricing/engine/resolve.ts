import type { MoneySet } from "@/lib/money";
import type { EngineRule } from "../schema/priceRules";
import { buildWindows, type PriceTarget } from "./windows";

export type ResolvedPrice = {
  priceMoney: MoneySet;
  /** The rule that set the price, or null when the base price applies. */
  ruleId: string | null;
};

/**
 * The price of a target at one instant. With no rule covering `at`, that is
 * the base price, unchanged - the identity every existing page relies on.
 */
export function resolvePriceAt(target: PriceTarget, rules: EngineRule[], at: Date): ResolvedPrice {
  const [window] = buildWindows(target, rules, at, new Date(at.getTime() + 1));
  return window
    ? { priceMoney: window.priceMoney, ruleId: window.ruleId }
    : { priceMoney: target.baseMoney, ruleId: null };
}
