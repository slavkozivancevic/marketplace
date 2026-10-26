import { describe, it, expect } from "vitest";
import {
  publicMoneyFields,
  publicVariantMoneyFields,
  secondsUntilNextPriceChange,
  variantCompareAt,
  withoutEffective,
} from "./projection";

const set = (usd: number) => ({ primary: "usd", amounts: { usd }, authored: ["usd"], rates: { usd: 1 } });

const row = {
  id: "p1",
  price: 1000,
  priceMoney: set(1000),
  compareAtPrice: 1500,
  compareAtPriceMoney: set(1500),
  costPrice: null,
  costPriceMoney: null,
  effectivePrice: 800,
  effectivePriceMoney: set(800),
  effectiveCompareAtPrice: 1000,
  effectiveCompareAtPriceMoney: set(1000),
  effectiveRuleId: "r1",
  effectiveRuleLabel: "Christmas",
  effectiveUntil: new Date("2026-12-26T22:59:00Z"),
};

describe("publicMoneyFields", () => {
  it("puts the effective price under the names the storefront already reads", () => {
    const m = publicMoneyFields(row);
    expect(m.price).toBe(800);
    expect(m.priceMoney.amounts.usd).toBe(800);
    expect(m.compareAtPrice).toBe(1000);
    expect(m.compareAtPriceMoney?.amounts.usd).toBe(1000);
  });

  it("is the base price when no rule applies", () => {
    const m = publicMoneyFields({
      ...row,
      effectivePrice: 1000,
      effectivePriceMoney: set(1000),
      effectiveCompareAtPrice: 1500,
      effectiveCompareAtPriceMoney: set(1500),
    });
    expect([m.price, m.compareAtPrice]).toEqual([row.price, row.compareAtPrice]);
  });
});

describe("variantCompareAt", () => {
  const sellerWas = { effectiveRuleId: null, effectiveCompareAtPriceMoney: set(1500) };

  it("inherits the product's compare-at when neither is under a rule", () => {
    const v = { effectiveRuleId: null, effectiveCompareAtPriceMoney: null };
    expect(variantCompareAt(v, sellerWas)?.amounts.usd).toBe(1500);
  });

  it("never inherits while the variant is under a rule", () => {
    const v = { effectiveRuleId: "r1", effectiveCompareAtPriceMoney: null };
    expect(variantCompareAt(v, sellerWas)).toBeNull();
  });

  it("keeps the variant's own reference under a rule", () => {
    const v = { effectiveRuleId: "r1", effectiveCompareAtPriceMoney: set(1000) };
    expect(variantCompareAt(v, sellerWas)?.amounts.usd).toBe(1000);
  });

  it("does not inherit a product-level Omnibus reference", () => {
    const v = { effectiveRuleId: null, effectiveCompareAtPriceMoney: null };
    const productUnderRule = { effectiveRuleId: "r1", effectiveCompareAtPriceMoney: set(1500) };
    expect(variantCompareAt(v, productUnderRule)).toBeNull();
  });
});

describe("publicVariantMoneyFields", () => {
  it("blocks client-side inheritance with an equal, non-reducing compare-at", () => {
    const variant = { ...row, effectiveCompareAtPrice: null, effectiveCompareAtPriceMoney: null };
    const m = publicVariantMoneyFields(variant, {
      effectiveRuleId: null,
      effectiveCompareAtPriceMoney: set(1500),
    });
    expect(m.compareAtPrice).toBe(m.price);
  });

  it("leaves a legitimately inherited compare-at to the client", () => {
    const variant = {
      ...row,
      effectiveRuleId: null,
      effectiveCompareAtPrice: null,
      effectiveCompareAtPriceMoney: null,
    };
    const m = publicVariantMoneyFields(variant, {
      effectiveRuleId: null,
      effectiveCompareAtPriceMoney: set(1500),
    });
    expect(m.compareAtPrice).toBeNull();
  });
});

describe("withoutEffective", () => {
  it("drops every read-model column and keeps the rest", () => {
    const out = withoutEffective(row);
    expect(Object.keys(out).filter((k) => k.startsWith("effective"))).toEqual([]);
    expect(out.id).toBe("p1");
  });
});

describe("secondsUntilNextPriceChange", () => {
  const now = new Date("2026-12-24T16:59:00Z").getTime();

  it("is the earliest upcoming change, rounded up", () => {
    expect(
      secondsUntilNextPriceChange(
        [
          { effectiveUntil: new Date("2026-12-24T17:00:00.5Z") },
          { effectiveUntil: null },
          { effectiveUntil: new Date("2026-12-25T00:00:00Z") },
        ],
        now,
      ),
    ).toBe(61);
  });

  it("is null when nothing is going to change", () => {
    expect(secondsUntilNextPriceChange([{ effectiveUntil: null }], now)).toBeNull();
  });

  it("never drops below 2 seconds, even for a boundary already passed", () => {
    expect(
      secondsUntilNextPriceChange([{ effectiveUntil: new Date("2026-12-24T16:00:00Z") }], now),
    ).toBe(2);
  });
});
