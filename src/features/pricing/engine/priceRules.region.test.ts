import { describe, it, expect } from "vitest";
import type { MoneySet } from "@/lib/money";
import {
  applyMarket,
  countryClockKey,
  marketClockKey,
  ruleClockKey,
  type MarketRule,
  type MarketRules,
  type MarketViewer,
  type NeutralPrice,
} from "./market";
import { money } from "./testRules";

const EUROZONE = "m-eurozone";
const DEFAULT = "m-default";

const germany: MarketViewer = { country: "DE", marketId: EUROZONE, countryMovedAt: null };
const france: MarketViewer = { country: "FR", marketId: EUROZONE, countryMovedAt: null };
const unknown: MarketViewer = { country: "XX", marketId: DEFAULT, countryMovedAt: null };
const nobody: MarketViewer = { country: null, marketId: null, countryMovedAt: null };

let seq = 0;
function marketRule(overrides: Partial<MarketRule> = {}): MarketRule {
  seq += 1;
  return {
    id: `mr-${String(seq).padStart(3, "0")}`,
    name: `Market rule ${seq}`,
    variantId: null,
    adjustment: "PERCENT",
    percentBps: 1000,
    amountMoney: null,
    priority: 0,
    marketId: EUROZONE,
    countryCode: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

const hundred = money({ usd: 10000, eur: 10000, rsd: 1000000 });

function neutral(priceMoney: MoneySet, extra: Partial<NeutralPrice> = {}): NeutralPrice {
  return { priceMoney, compareAtMoney: null, schedule: { ruleId: null, since: null }, ...extra };
}

/** Each rule's target clock at `at`, as `touchMarketRules` would have left it. */
function clocksOf(rules: MarketRule[], at: string): Record<string, Date> {
  const out: Record<string, Date> = {};
  for (const r of rules) {
    const key = ruleClockKey(r);
    if (key) out[key] = new Date(at);
  }
  return out;
}

/** Rules that have not changed since long before any window in these tests. */
const settled = (rules: MarketRule[]): MarketRules => ({ rules, clocks: clocksOf(rules, "2026-08-01T00:00:00Z") });

const NO_MARKET_RULES: MarketRules = { rules: [], clocks: {} };

describe("applyMarket - precedence (acceptance 15a)", () => {
  const eurozone = marketRule({ name: "Eurozone", percentBps: 1000 });
  const germanyRule = marketRule({ name: "Germany", marketId: null, countryCode: "DE", percentBps: -500 });

  it("a country rule wins over its market's rule for a buyer in that country", () => {
    const r = applyMarket(neutral(hundred), null, settled([eurozone, germanyRule]), germany);
    expect(r.marketRule?.name).toBe("Germany");
    expect(r.priceMoney.amounts.eur).toBe(9500);
  });

  it("the market rule applies to a buyer whose country has no rule of its own", () => {
    const r = applyMarket(neutral(hundred), null, settled([eurozone, germanyRule]), france);
    expect(r.marketRule?.name).toBe("Eurozone");
    expect(r.priceMoney.amounts.eur).toBe(11000);
  });

  it("a variant-level market price wins over a product-level country discount", () => {
    const variantFixed = marketRule({
      name: "Variant Eurozone",
      variantId: "v1",
      adjustment: "FIXED_PRICE",
      percentBps: null,
      amountMoney: money({ usd: 7000, eur: 6500, rsd: 750000 }, "eur"),
    });
    const r = applyMarket(neutral(hundred), "v1", settled([germanyRule, variantFixed]), germany);
    expect(r.marketRule?.name).toBe("Variant Eurozone");
    expect(r.priceMoney.amounts).toEqual({ usd: 7000, eur: 6500, rsd: 750000 });
  });

  it("higher priority, then later createdAt, break a tie at the same scope and geography", () => {
    const low = marketRule({ name: "Low", priority: 1, percentBps: 500 });
    const high = marketRule({ name: "High", priority: 5, percentBps: 2000 });
    expect(applyMarket(neutral(hundred), null, settled([low, high]), france).marketRule?.name).toBe("High");

    const older = marketRule({ name: "Older", createdAt: new Date("2026-08-01T00:00:00Z") });
    const newer = marketRule({ name: "Newer", createdAt: new Date("2026-08-02T00:00:00Z") });
    expect(applyMarket(neutral(hundred), null, settled([older, newer]), france).marketRule?.name).toBe("Newer");
  });

  it("skips a rule whose result is not sellable and takes the next one", () => {
    const tooMuchOff = marketRule({
      name: "Too much off",
      marketId: null,
      countryCode: "DE",
      adjustment: "AMOUNT_OFF",
      percentBps: null,
      amountMoney: money({ usd: 20000, eur: 20000, rsd: 2000000 }),
    });
    const eurozone = marketRule({ name: "Eurozone" });
    const r = applyMarket(neutral(hundred), null, settled([tooMuchOff, eurozone]), germany);
    expect(r.marketRule?.name).toBe("Eurozone");
  });
});

describe("applyMarket - scope (acceptance 16)", () => {
  const productRule = marketRule({ name: "All variants", percentBps: -1000 });
  const v1Base = money({ usd: 5000, eur: 4000, rsd: 500000 });
  const v2Base = money({ usd: 8000, eur: 7000, rsd: 900000 });

  it("a product-level rule prices every variant from its own base", () => {
    expect(applyMarket(neutral(v1Base), "v1", settled([productRule]), france).priceMoney.amounts).toEqual({
      usd: 4500,
      eur: 3600,
      rsd: 450000,
    });
    expect(applyMarket(neutral(v2Base), "v2", settled([productRule]), france).priceMoney.amounts).toEqual({
      usd: 7200,
      eur: 6300,
      rsd: 810000,
    });
  });

  it("a variant-level rule overrides it for that variant only", () => {
    const v1Only = marketRule({ name: "v1 only", variantId: "v1", percentBps: -5000 });
    const rules = settled([productRule, v1Only]);
    expect(applyMarket(neutral(v1Base), "v1", rules, france).marketRule?.name).toBe("v1 only");
    expect(applyMarket(neutral(v2Base), "v2", rules, france).marketRule?.name).toBe("All variants");
  });

  it("a variant-level rule never reaches the product row or another variant", () => {
    const v1Only = marketRule({ variantId: "v1" });
    expect(applyMarket(neutral(hundred), null, settled([v1Only]), france).marketRule).toBeNull();
    expect(applyMarket(neutral(hundred), "v2", settled([v1Only]), france).marketRule).toBeNull();
  });
});

describe("applyMarket - fallback (acceptance 17)", () => {
  const rules = settled([marketRule()]);

  it("an unknown country falls into the default market and, with no rule there, pays the neutral price", () => {
    const r = applyMarket(neutral(hundred), null, rules, unknown);
    expect(r).toEqual({ priceMoney: hundred, compareAtMoney: null, marketRule: null });
  });

  it("no country at all is the neutral price too", () => {
    expect(applyMarket(neutral(hundred), null, rules, nobody).priceMoney).toBe(hundred);
  });

  it("a rule on the default market reaches buyers whose country maps nowhere", () => {
    const onDefault = settled([marketRule({ marketId: DEFAULT, percentBps: -1000 })]);
    expect(applyMarket(neutral(hundred), null, onDefault, unknown).priceMoney.amounts.eur).toBe(9000);
  });

  it("with no rules the neutral price comes back as the same object", () => {
    const price = neutral(hundred, { compareAtMoney: money({ usd: 12000, eur: 12000, rsd: 1200000 }) });
    const r = applyMarket(price, null, NO_MARKET_RULES, germany);
    expect(r.priceMoney).toBe(price.priceMoney);
    expect(r.compareAtMoney).toBe(price.compareAtMoney);
  });
});

describe("applyMarket - layered on a schedule promo", () => {
  // Base 100, Black Friday -20% active since 2026-11-27, Eurozone +10%.
  const promo = neutral(money({ usd: 8000, eur: 8000, rsd: 800000 }), {
    compareAtMoney: hundred,
    schedule: { ruleId: "black-friday", since: new Date("2026-11-27T00:00:00Z") },
  });
  const eurozone = marketRule({ name: "Eurozone", percentBps: 1000 });

  it("applies the market rule on top of the promo price", () => {
    const r = applyMarket(promo, null, settled([eurozone]), france);
    expect(r.priceMoney.amounts.eur).toBe(8800);
  });

  it("moves the Omnibus reference with it when the market's 30 days were stable", () => {
    const r = applyMarket(promo, null, settled([eurozone]), france);
    expect(r.compareAtMoney?.amounts.eur).toBe(11000);
  });

  it("drops the reference when a rule aimed at the buyer's market changed inside the lookback", () => {
    const recent: MarketRules = { rules: [eurozone], clocks: clocksOf([eurozone], "2026-11-10T00:00:00Z") };
    expect(applyMarket(promo, null, recent, france).compareAtMoney).toBeNull();
  });

  it("drops the reference when a rule aimed at the buyer's country changed inside the lookback", () => {
    const germanyRule = marketRule({ marketId: null, countryCode: "DE", percentBps: -500 });
    const recent: MarketRules = { rules: [germanyRule], clocks: clocksOf([germanyRule], "2026-11-10T00:00:00Z") };
    expect(applyMarket(promo, null, recent, germany).compareAtMoney).toBeNull();
  });

  it("drops the reference when the buyer's country moved market inside the lookback", () => {
    const moved = { ...france, countryMovedAt: new Date("2026-11-20T00:00:00Z") };
    expect(applyMarket(promo, null, settled([eurozone]), moved).compareAtMoney).toBeNull();
  });

  it("drops the reference even with no matching rule, if a rule aimed at the buyer changed inside the lookback", () => {
    // A Eurozone -50% deleted last week priced this buyer lower than 100.
    const afterDelete: MarketRules = { rules: [], clocks: { [marketClockKey(EUROZONE)]: new Date("2026-11-20T00:00:00Z") } };
    const r = applyMarket(promo, null, afterDelete, france);
    expect(r.priceMoney).toBe(promo.priceMoney);
    expect(r.compareAtMoney).toBeNull();
  });

  it("keeps the default-market buyer's reference when only rules aimed elsewhere changed", () => {
    // Eurozone +10% and Germany -5% both created this week: neither ever priced a buyer outside them.
    const germanyRule = marketRule({ marketId: null, countryCode: "DE", percentBps: -500 });
    const recent: MarketRules = {
      rules: [eurozone, germanyRule],
      clocks: clocksOf([eurozone, germanyRule], "2026-11-20T00:00:00Z"),
    };
    const serbia: MarketViewer = { country: "RS", marketId: DEFAULT, countryMovedAt: null };
    const r = applyMarket(promo, null, recent, serbia);
    expect(r.marketRule).toBeNull();
    expect(r.compareAtMoney).toBe(hundred);
  });

  it("keeps a buyer's reference when another country moved market", () => {
    // France joined the Eurozone market last week; that is France's history, not Serbia's.
    const serbia: MarketViewer = { country: "RS", marketId: DEFAULT, countryMovedAt: null };
    expect(applyMarket(promo, null, settled([eurozone]), serbia).compareAtMoney).toBe(hundred);
  });

  it("a rule moved from one target to another clears both", () => {
    // Updated from Eurozone to Germany: touchMarketRules records both keys.
    const germanyRule = marketRule({ marketId: null, countryCode: "DE", percentBps: -500 });
    const moved: MarketRules = {
      rules: [germanyRule],
      clocks: {
        [marketClockKey(EUROZONE)]: new Date("2026-11-20T00:00:00Z"),
        [countryClockKey("DE")]: new Date("2026-11-20T00:00:00Z"),
      },
    };
    expect(applyMarket(promo, null, moved, france).compareAtMoney).toBeNull();
    expect(applyMarket(promo, null, moved, germany).compareAtMoney).toBeNull();
  });

  it("keeps the default reference for a product that never had a market rule, whatever the map did", () => {
    const moved = { ...france, countryMovedAt: new Date("2026-11-20T00:00:00Z") };
    expect(applyMarket(promo, null, NO_MARKET_RULES, moved).compareAtMoney).toBe(hundred);
  });

  it("a fixed market price is never announced as a reduction", () => {
    const fixed = marketRule({
      adjustment: "FIXED_PRICE",
      percentBps: null,
      amountMoney: money({ usd: 5000, eur: 5000, rsd: 500000 }),
    });
    const r = applyMarket(promo, null, settled([fixed]), france);
    expect(r.priceMoney.amounts.eur).toBe(5000);
    expect(r.compareAtMoney).toBeNull();
  });

  it("works the same on dates that arrived as JSON strings", () => {
    const json = JSON.parse(JSON.stringify({ promo, rules: settled([eurozone]), viewer: france }));
    const r = applyMarket(json.promo, null, json.rules, json.viewer);
    expect(r.priceMoney.amounts.eur).toBe(8800);
    expect(r.compareAtMoney?.amounts.eur).toBe(11000);
  });
});

describe("applyMarket - seller-typed compare-at", () => {
  it("moves with a percent rule while it stays above the price", () => {
    const price = neutral(hundred, { compareAtMoney: money({ usd: 12000, eur: 12000, rsd: 1200000 }) });
    const r = applyMarket(price, null, settled([marketRule({ percentBps: 1000 })]), france);
    expect(r.compareAtMoney?.amounts.eur).toBe(13200);
  });

  it("is dropped once rounding makes it no longer strictly above", () => {
    const price = neutral(money({ usd: 1000, eur: 1000, rsd: 100000 }), {
      compareAtMoney: money({ usd: 1001, eur: 1001, rsd: 100001 }),
    });
    const r = applyMarket(price, null, settled([marketRule({ percentBps: -5000 })]), france);
    expect(r.priceMoney.amounts.eur).toBe(500);
    expect(r.compareAtMoney).toBeNull();
  });
});
