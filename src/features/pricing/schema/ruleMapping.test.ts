import { describe, it, expect } from "vitest";
import { toRuleColumns, toRuleInput } from "./ruleMapping";
import type { PriceRuleInput } from "./priceRules";

const ONE_OFF: PriceRuleInput = {
  kind: "SCHEDULE",
  regionScope: "MARKET",
  marketId: null,
  countryCode: null,
  name: "  Christmas  ",
  variantId: null,
  adjustment: "PERCENT",
  percentBps: -2000,
  amount: { currency: "rsd", amount: 0 },
  priority: 3,
  active: true,
  timezone: "Europe/Belgrade",
  recurrence: "NONE",
  startDate: "2026-12-24",
  startTime: "18:00",
  endDate: "2026-12-26",
  endTime: "23:59",
  durationMinutes: null,
  weekdays: [],
  monthDay: null,
};

const WEEKLY: PriceRuleInput = {
  ...ONE_OFF,
  name: "Friday happy hour",
  recurrence: "WEEKLY",
  startDate: "2026-10-01",
  startTime: "17:00",
  endDate: "2026-12-31",
  endTime: null,
  durationMinutes: 240,
  weekdays: [5, 1, 5],
};

describe("toRuleColumns", () => {
  it("stores a one-off window as UTC instants with no recurrence fields", () => {
    const c = toRuleColumns(ONE_OFF);
    expect(c.name).toBe("Christmas");
    expect(c.startsAt.toISOString()).toBe("2026-12-24T17:00:00.000Z");
    expect(c.endsAt?.toISOString()).toBe("2026-12-26T22:59:00.000Z");
    expect([c.startMinute, c.durationMinutes, c.weekdays, c.monthDay]).toEqual([null, null, [], null]);
  });

  it("stores a weekly rule with sorted, unique weekdays and its local start minute", () => {
    const c = toRuleColumns(WEEKLY);
    expect(c.weekdays).toEqual([1, 5]);
    expect(c.startMinute).toBe(17 * 60);
    expect(c.durationMinutes).toBe(240);
  });

  it("clears the percent of a fixed rule", () => {
    expect(toRuleColumns({ ...ONE_OFF, adjustment: "FIXED_PRICE" }).percentBps).toBeNull();
  });
});

describe("toRuleInput", () => {
  it("round-trips a one-off rule back to what the seller typed", () => {
    const back = toRuleInput(toRuleColumns(ONE_OFF), null, "rsd");
    expect(back).toEqual({ ...ONE_OFF, name: "Christmas" });
  });

  it("round-trips a weekly series, including its last day", () => {
    const back = toRuleInput(toRuleColumns(WEEKLY), null, "rsd");
    expect(back).toEqual({ ...WEEKLY, weekdays: [1, 5] });
  });

  it("opens a fixed rule on the amount in the currency it was typed in", () => {
    const set = {
      primary: "rsd" as const,
      amounts: { usd: 921, eur: 851, rsd: 99900 },
      authored: ["rsd" as const],
      rates: { usd: 1 },
    };
    const back = toRuleInput(toRuleColumns({ ...ONE_OFF, adjustment: "FIXED_PRICE" }), set, "usd");
    expect(back.amount).toEqual({ currency: "rsd", amount: 99900 });
  });
});

describe("market rules", () => {
  const COUNTRY: PriceRuleInput = {
    ...ONE_OFF,
    kind: "REGION",
    regionScope: "COUNTRY",
    marketId: "m-stale",
    countryCode: "DE",
  };

  it("keeps only the chosen target and stores neutral time columns", () => {
    const c = toRuleColumns(COUNTRY);
    expect(c.kind).toBe("REGION");
    expect(c.countryCode).toBe("DE");
    expect(c.marketId).toBeNull();
    expect(c).toMatchObject({ startsAt: new Date(0), endsAt: null, timezone: "UTC", recurrence: "NONE" });
  });

  it("keeps the market and drops a stale country when the target is a market", () => {
    const c = toRuleColumns({ ...COUNTRY, regionScope: "MARKET", marketId: "m-1" });
    expect(c.marketId).toBe("m-1");
    expect(c.countryCode).toBeNull();
  });

  it("saving the same rule twice writes the same columns", () => {
    expect(toRuleColumns(COUNTRY)).toEqual(toRuleColumns(COUNTRY));
  });

  it("opens on the scope it was saved with", () => {
    expect(toRuleInput(toRuleColumns(COUNTRY), null, "usd")).toMatchObject({ kind: "REGION", regionScope: "COUNTRY", countryCode: "DE" });
    const market = toRuleInput(toRuleColumns({ ...COUNTRY, regionScope: "MARKET", marketId: "m-1" }), null, "usd");
    expect(market).toMatchObject({ regionScope: "MARKET", marketId: "m-1", countryCode: null });
  });

  it("a schedule rule never carries a target", () => {
    const c = toRuleColumns({ ...ONE_OFF, marketId: "m-1", countryCode: "DE" });
    expect(c.marketId).toBeNull();
    expect(c.countryCode).toBeNull();
  });
});
