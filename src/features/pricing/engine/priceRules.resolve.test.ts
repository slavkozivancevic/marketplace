import { describe, it, expect } from "vitest";
import { applyAdjustment } from "./adjust";
import { compareRules } from "./precedence";
import { resolvePriceAt } from "./resolve";
import { BASE, money, rule } from "./testRules";

const target = { productId: "p1", variantId: null, baseMoney: BASE };
const DURING = new Date("2026-12-25T12:00:00Z");

describe("resolvePriceAt", () => {
  it("returns the base price untouched when there are no rules", () => {
    const r = resolvePriceAt(target, [], DURING);
    expect(r.ruleId).toBeNull();
    expect(r.priceMoney).toBe(BASE);
  });

  it("returns the base price outside every window", () => {
    const r = resolvePriceAt(target, [rule()], new Date("2026-12-27T12:00:00Z"));
    expect(r).toEqual({ priceMoney: BASE, ruleId: null });
  });

  it("ignores inactive rules and other products' rules", () => {
    const rules = [rule({ active: false }), rule({ productId: "p2" })];
    expect(resolvePriceAt(target, rules, DURING).ruleId).toBeNull();
  });
});

describe("applyAdjustment - percent", () => {
  it("applies the percent to each currency separately, rounding down", () => {
    const set = applyAdjustment(BASE, { adjustment: "PERCENT", percentBps: -2000, amountMoney: null });
    // 1.000,05 RSD -> 800,04; 10,99 USD -> 8,792 -> 8,79; 9,99 EUR -> 7,992 -> 7,99.
    expect(set?.amounts).toEqual({ rsd: 80004, usd: 879, eur: 799 });
  });

  it("rounds a markup down too, so it is at most the advertised one", () => {
    const set = applyAdjustment(money({ usd: 1000, eur: 999, rsd: 100000 }), {
      adjustment: "PERCENT",
      percentBps: 1000,
      amountMoney: null,
    });
    // 9,99 EUR +10% = 10,989 -> 10,98.
    expect(set?.amounts.eur).toBe(1098);
  });

  it("never reads a rate: the result ignores the set's rates entirely", () => {
    const a = applyAdjustment(BASE, { adjustment: "PERCENT", percentBps: -2000, amountMoney: null });
    const b = applyAdjustment(
      { ...BASE, rates: { usd: 1, eur: 9, rsd: 9 } },
      { adjustment: "PERCENT", percentBps: -2000, amountMoney: null },
    );
    expect(a?.amounts).toEqual(b?.amounts);
  });

  it("keeps the base set's primary and authored currencies", () => {
    const set = applyAdjustment(BASE, { adjustment: "PERCENT", percentBps: -2000, amountMoney: null });
    expect(set?.primary).toBe("rsd");
    expect(set?.authored).toEqual(["rsd"]);
  });

  it("leaves a currency missing from the base missing", () => {
    const set = applyAdjustment(money({ usd: 1000, rsd: 100000 }), {
      adjustment: "PERCENT",
      percentBps: -1000,
      amountMoney: null,
    });
    expect(set?.amounts).toEqual({ usd: 900, rsd: 90000 });
  });
});

describe("applyAdjustment - fixed", () => {
  it("keeps a fixed price typed as 999 RSD at exactly 999 RSD", () => {
    const fixed = money({ usd: 921, eur: 851, rsd: 99900 });
    const set = applyAdjustment(BASE, { adjustment: "FIXED_PRICE", percentBps: null, amountMoney: fixed });
    expect(set?.amounts.rsd).toBe(99900);
    expect(set).not.toBe(fixed);
  });

  it("subtracts a fixed amount per currency", () => {
    const off = money({ usd: 99, eur: 99, rsd: 10000 });
    const set = applyAdjustment(BASE, { adjustment: "AMOUNT_OFF", percentBps: null, amountMoney: off });
    expect(set?.amounts).toEqual({ usd: 1000, eur: 900, rsd: 90005 });
  });

  it("refuses a result that is zero or negative in any currency", () => {
    const off = money({ usd: 100, eur: 999, rsd: 100 });
    expect(
      applyAdjustment(BASE, { adjustment: "AMOUNT_OFF", percentBps: null, amountMoney: off }),
    ).toBeNull();
  });

  it("refuses a fixed rule without an amount", () => {
    expect(
      applyAdjustment(BASE, { adjustment: "FIXED_PRICE", percentBps: null, amountMoney: null }),
    ).toBeNull();
  });
});

describe("compareRules", () => {
  const sorted = (...rules: ReturnType<typeof rule>[]) =>
    [...rules].sort(compareRules).map((r) => r.id);

  it("puts a variant rule before a product rule, whatever its priority", () => {
    const product = rule({ priority: 999 });
    const variant = rule({ variantId: "v1", priority: 0 });
    expect(sorted(product, variant)[0]).toBe(variant.id);
  });

  it("puts a country rule before a market rule before a default one", () => {
    const def = rule({ priority: 50 });
    const market = rule({ marketId: "eurozone", priority: 10 });
    const country = rule({ countryCode: "DE" });
    expect(sorted(def, market, country)).toEqual([country.id, market.id, def.id]);
  });

  it("then higher priority, then later createdAt, then id", () => {
    const low = rule({ priority: 1 });
    const high = rule({ priority: 2 });
    expect(sorted(low, high)[0]).toBe(high.id);

    const older = rule({ createdAt: new Date("2026-01-01T00:00:00Z") });
    const newer = rule({ createdAt: new Date("2026-02-01T00:00:00Z") });
    expect(sorted(older, newer)[0]).toBe(newer.id);

    const sameA = rule({ id: "a" });
    const sameB = rule({ id: "b" });
    expect(sorted(sameB, sameA)).toEqual(["a", "b"]);
  });

  it("is a total order: no two distinct rules compare equal", () => {
    expect(compareRules(rule({ id: "x" }), rule({ id: "y" }))).not.toBe(0);
  });
});

describe("resolvePriceAt - zero-price defence", () => {
  it("skips a rule that would make the price unsellable and falls through", () => {
    const broken = rule({
      adjustment: "AMOUNT_OFF",
      amountMoney: money({ usd: 5000, eur: 5000, rsd: 500000 }),
      priority: 10,
    });
    const fine = rule({ priority: 1 });
    expect(resolvePriceAt(target, [broken, fine], DURING).ruleId).toBe(fine.id);
  });
});
