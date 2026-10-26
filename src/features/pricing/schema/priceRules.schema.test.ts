import { describe, it, expect } from "vitest";
import {
  PRICE_PERCENT_BPS_MAX,
  PRICE_PERCENT_BPS_MIN,
  PRICE_WINDOW_MIN_MINUTES,
  priceRuleSchema,
  ruleBoundsUtc,
  type PriceRuleInput,
} from "./priceRules";

const VALID: PriceRuleInput = {
  kind: "SCHEDULE",
  regionScope: "MARKET",
  marketId: null,
  countryCode: null,
  name: "Christmas",
  variantId: null,
  adjustment: "PERCENT",
  percentBps: -2000,
  amount: { currency: "rsd", amount: 0 },
  priority: 0,
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

/** The i18n keys of every issue, so a test names WHICH rule fired. */
function issues(input: Partial<PriceRuleInput>): string[] {
  const r = priceRuleSchema.safeParse({ ...VALID, ...input });
  if (r.success) return [];
  return r.error.issues.map((i) => {
    const params = (i as { params?: { i18n?: string } }).params;
    return params?.i18n ?? i.code;
  });
}

describe("priceRuleSchema", () => {
  it("accepts a valid one-off percent rule", () => {
    expect(issues({})).toEqual([]);
  });

  it("bounds the percentage and refuses zero", () => {
    expect(issues({ percentBps: PRICE_PERCENT_BPS_MIN })).toEqual([]);
    expect(issues({ percentBps: PRICE_PERCENT_BPS_MAX })).toEqual([]);
    expect(issues({ percentBps: PRICE_PERCENT_BPS_MIN - 1 })).toEqual(["priceRulePercentRange"]);
    expect(issues({ percentBps: PRICE_PERCENT_BPS_MAX + 1 })).toEqual(["priceRulePercentRange"]);
    expect(issues({ percentBps: 0 })).toEqual(["priceRulePercentRange"]);
  });

  it("requires a positive amount for fixed rules only", () => {
    expect(issues({ adjustment: "FIXED_PRICE" })).toEqual(["priceRuleAmountPositive"]);
    expect(
      issues({ adjustment: "AMOUNT_OFF", amount: { currency: "rsd", amount: 10000 } }),
    ).toEqual([]);
  });

  it("refuses an unknown timezone", () => {
    expect(issues({ timezone: "Mars/Olympus" })).toContain("priceRuleTimezoneInvalid");
  });

  it("refuses an impossible date", () => {
    expect(issues({ startDate: "2026-02-31" })).toContain("invalid");
  });

  it("requires an end for a one-off rule, after its start", () => {
    expect(issues({ endDate: null })).toEqual(["priceRuleEndRequired"]);
    expect(issues({ endDate: "2026-12-24", endTime: "17:00" })).toEqual(["priceRuleEndBeforeStart"]);
  });

  it(`refuses a window shorter than ${PRICE_WINDOW_MIN_MINUTES} minutes, at the boundary`, () => {
    expect(issues({ endDate: "2026-12-24", endTime: "18:59" })).toEqual(["priceRuleWindowTooShort"]);
    expect(issues({ endDate: "2026-12-24", endTime: "19:00" })).toEqual([]);
  });

  it("bounds a recurring occurrence between 1 hour and 24 hours", () => {
    const daily = { recurrence: "DAILY" as const, endDate: null, endTime: null };
    expect(issues({ ...daily, durationMinutes: 60 })).toEqual([]);
    expect(issues({ ...daily, durationMinutes: 1440 })).toEqual([]);
    expect(issues({ ...daily, durationMinutes: 59 })).toEqual(["priceRuleDurationRange"]);
    expect(issues({ ...daily, durationMinutes: 1441 })).toEqual(["priceRuleDurationRange"]);
    expect(issues({ ...daily, durationMinutes: null })).toEqual(["priceRuleDurationRange"]);
  });

  it("needs weekdays for a weekly rule and a day for a monthly one", () => {
    const base = { endDate: null, endTime: null, durationMinutes: 120 };
    expect(issues({ ...base, recurrence: "WEEKLY", weekdays: [] })).toEqual([
      "priceRuleWeekdaysRequired",
    ]);
    expect(issues({ ...base, recurrence: "WEEKLY", weekdays: [5] })).toEqual([]);
    expect(issues({ ...base, recurrence: "MONTHLY", monthDay: 32 })).toEqual([
      "priceRuleMonthDayRange",
    ]);
    expect(issues({ ...base, recurrence: "MONTHLY", monthDay: 31 })).toEqual([]);
  });

  it("refuses a series that ends before it starts", () => {
    expect(
      issues({ recurrence: "DAILY", durationMinutes: 60, endDate: "2026-12-01", endTime: null }),
    ).toEqual(["priceRuleEndBeforeStart"]);
  });
});

describe("priceRuleSchema - market rules", () => {
  const MARKET = { kind: "REGION" as const, regionScope: "MARKET" as const, marketId: "m-1" };

  it("skips every time field: a market rule has no schedule", () => {
    expect(issues({ ...MARKET, startDate: "", startTime: "", endDate: null, timezone: "Nowhere/Nope" })).toEqual([]);
  });

  it("requires the market when it targets a market", () => {
    expect(issues({ ...MARKET, marketId: null })).toEqual(["priceRuleMarketRequired"]);
  });

  it("requires a known, upper-case country when it targets a country", () => {
    const country = { kind: "REGION" as const, regionScope: "COUNTRY" as const };
    expect(issues({ ...country, countryCode: "DE" })).toEqual([]);
    expect(issues({ ...country, countryCode: null })).toEqual(["priceRuleCountryRequired"]);
    expect(issues({ ...country, countryCode: "de" })).toEqual(["priceRuleCountryRequired"]);
    expect(issues({ ...country, countryCode: "XX" })).toEqual(["priceRuleCountryRequired"]);
  });

  it("still checks the adjustment", () => {
    expect(issues({ ...MARKET, percentBps: 0 })).toEqual(["priceRulePercentRange"]);
  });
});

describe("ruleBoundsUtc", () => {
  it("converts a one-off window from local time", () => {
    const b = ruleBoundsUtc(VALID);
    expect(b.startsAt.toISOString()).toBe("2026-12-24T17:00:00.000Z");
    expect(b.endsAt?.toISOString()).toBe("2026-12-26T22:59:00.000Z");
  });

  it("bounds a recurring series by whole local days", () => {
    const b = ruleBoundsUtc({
      ...VALID,
      recurrence: "DAILY",
      durationMinutes: 60,
      endDate: "2026-12-31",
      endTime: null,
    });
    expect(b.startsAt.toISOString()).toBe("2026-12-23T23:00:00.000Z");
    expect(b.endsAt?.toISOString()).toBe("2026-12-31T23:00:00.000Z");
  });
});
