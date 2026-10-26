import { describe, it, expect } from "vitest";
import type { MoneySet } from "@/lib/money";
import type { MarketRule, MarketViewer } from "@/features/pricing/engine/market";
import type { SerializedProductListItem, SerializedPublicProduct } from "@/types/types";
import { listItemForViewer, productForViewer } from "./viewerPrices";

const set = (eur: number): MoneySet => ({
  primary: "eur",
  amounts: { usd: eur + 100, eur, rsd: eur * 100 },
  authored: ["eur"],
  rates: { usd: 1 },
});

const france: MarketViewer = { country: "FR", marketId: "m-eu", countryMovedAt: null };
const nobody: MarketViewer = { country: null, marketId: "m-default", countryMovedAt: null };

function rule(overrides: Partial<MarketRule> = {}): MarketRule {
  return {
    id: "r1",
    name: "Eurozone",
    variantId: null,
    adjustment: "PERCENT",
    percentBps: 1000,
    amountMoney: null,
    priority: 0,
    marketId: "m-eu",
    countryCode: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

const settled = (rules: MarketRule[]) => ({ rules, clocks: { "m:m-eu": new Date("2026-01-01T00:00:00Z") } });
const noSchedule = { ruleId: null, since: null };

// Only the fields the transform reads; the rest of a payload is passed through.
function item(over: Partial<SerializedProductListItem> = {}) {
  return {
    id: "p1",
    price: 1100,
    priceMoney: set(1000),
    compareAtPrice: null,
    compareAtPriceMoney: null,
    marketRules: { rules: [], clocks: {} },
    schedule: noSchedule,
    ...over,
  } as unknown as SerializedProductListItem;
}

function variant(id: string, price: MoneySet, compareAt: MoneySet | null) {
  return {
    id,
    price: price.amounts.usd!,
    priceMoney: price,
    compareAtPrice: compareAt ? compareAt.amounts.usd! : null,
    compareAtPriceMoney: compareAt,
    schedule: noSchedule,
    optionValues: [],
  };
}

function product(over: Partial<SerializedPublicProduct>) {
  return {
    id: "p1",
    price: 1100,
    priceMoney: set(1000),
    compareAtPrice: null,
    compareAtPriceMoney: null,
    schedule: noSchedule,
    marketRules: { rules: [], clocks: {} },
    variants: [],
    ...over,
  } as unknown as SerializedPublicProduct;
}

describe("listItemForViewer", () => {
  it("leaves a product without market rules exactly as it came", () => {
    const p = item();
    const r = listItemForViewer(p, france);
    expect(r.priceMoney).toBe(p.priceMoney);
    expect(r.marketRule).toBeNull();
  });

  it("writes the viewer's price back under the names cards read, mirror included", () => {
    const r = listItemForViewer(item({ marketRules: settled([rule()]) }), france);
    expect(r.priceMoney.amounts.eur).toBe(1100);
    expect(r.price).toBe(r.priceMoney.amounts.usd);
    expect(r.marketRule).toEqual({ id: "r1", name: "Eurozone" });
  });

  it("another market's buyer sees the neutral price", () => {
    const r = listItemForViewer(item({ marketRules: settled([rule()]) }), nobody);
    expect(r.priceMoney.amounts.eur).toBe(1000);
    expect(r.marketRule).toBeNull();
  });
});

describe("productForViewer", () => {
  it("prices every variant from its own base", () => {
    const p = product({
      marketRules: settled([rule()]),
      variants: [variant("v1", set(500), null), variant("v2", set(800), null)] as never,
    });
    const r = productForViewer(p, france);
    expect(r.variants.map((v) => v.priceMoney.amounts.eur)).toEqual([550, 880]);
  });

  it("makes an inherited compare-at explicit, moved by the variant's own rule", () => {
    // The product's seller-typed "was" 1200 is what a variant without its own inherits.
    const p = product({
      compareAtPrice: 1300,
      compareAtPriceMoney: set(1200),
      marketRules: settled([rule({ id: "v1-rule", variantId: "v1", percentBps: -1000 })]),
      variants: [variant("v1", set(1000), null)] as never,
    });
    const [v1] = productForViewer(p, france).variants;
    expect(v1.priceMoney.amounts.eur).toBe(900);
    expect(v1.compareAtPriceMoney?.amounts.eur).toBe(1080);
  });

  it("blocks the inheritance where the market leaves no reduction to announce", () => {
    const fixed = rule({ adjustment: "FIXED_PRICE", percentBps: null, amountMoney: set(700) });
    const p = product({
      compareAtPrice: 1300,
      compareAtPriceMoney: set(1200),
      marketRules: settled([fixed]),
      variants: [variant("v1", set(1000), null)] as never,
    });
    const [v1] = productForViewer(p, france).variants;
    // Equal to the price = "no reduction" everywhere, and no fallback to the product's.
    expect(v1.compareAtPriceMoney).toEqual(v1.priceMoney);
  });

  it("keeps a variant without any compare-at plain", () => {
    const p = product({ marketRules: settled([rule()]), variants: [variant("v1", set(1000), null)] as never });
    expect(productForViewer(p, france).variants[0].compareAtPriceMoney).toBeNull();
  });
});
