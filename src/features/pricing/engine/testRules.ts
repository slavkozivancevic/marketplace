import type { MoneySet } from "@/lib/money";
import type { EngineRule } from "../schema/priceRules";

/**
 * Fixtures shared by the pricing engine tests. The base set is deliberately
 * NOT consistent with any exchange rate - if the engine ever converted, the
 * tests would see it.
 */
export const BASE: MoneySet = {
  primary: "rsd",
  amounts: { usd: 1099, eur: 999, rsd: 100005 },
  authored: ["rsd"],
  rates: { usd: 1, eur: 0.5, rsd: 1000 },
};

export function money(amounts: MoneySet["amounts"], primary: MoneySet["primary"] = "rsd"): MoneySet {
  return { primary, amounts, authored: [primary], rates: { usd: 1, eur: 0.92, rsd: 108.5 } };
}

let seq = 0;

/** A one-off product-level 20% off rule for 2026-12-24, overridable per test. */
export function rule(overrides: Partial<EngineRule> = {}): EngineRule {
  seq += 1;
  return {
    id: `rule-${String(seq).padStart(3, "0")}`,
    productId: "p1",
    variantId: null,
    kind: "SCHEDULE",
    name: `Rule ${seq}`,
    adjustment: "PERCENT",
    percentBps: -2000,
    amountMoney: null,
    priority: 0,
    active: true,
    startsAt: new Date("2026-12-24T17:00:00Z"),
    endsAt: new Date("2026-12-26T22:59:00Z"),
    timezone: "Europe/Belgrade",
    recurrence: "NONE",
    startMinute: null,
    durationMinutes: null,
    weekdays: [],
    monthDay: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    ...overrides,
  };
}
