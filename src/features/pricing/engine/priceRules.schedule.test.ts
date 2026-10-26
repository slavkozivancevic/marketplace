import { describe, it, expect } from "vitest";
import { expandOccurrences } from "./occurrences";
import { resolvePriceAt } from "./resolve";
import { zonedToUtc } from "./timezone";
import { BASE, rule } from "./testRules";

const TZ = "Europe/Belgrade";
const target = { productId: "p1", variantId: null, baseMoney: BASE };
const iso = (d: Date) => d.toISOString();

describe("zonedToUtc", () => {
  it("converts winter and summer wall times with the right offset", () => {
    expect(iso(zonedToUtc({ year: 2026, month: 12, day: 24 }, 18 * 60, TZ))).toBe(
      "2026-12-24T17:00:00.000Z",
    );
    expect(iso(zonedToUtc({ year: 2026, month: 7, day: 1 }, 18 * 60, TZ))).toBe(
      "2026-07-01T16:00:00.000Z",
    );
  });

  it("moves a wall time inside the spring-forward gap forward by the gap", () => {
    // 2027-03-28 02:30 does not exist in Belgrade; it reads as 03:30 CEST.
    expect(iso(zonedToUtc({ year: 2027, month: 3, day: 28 }, 2 * 60 + 30, TZ))).toBe(
      "2027-03-28T01:30:00.000Z",
    );
  });

  it("resolves a wall time that happens twice to the earlier instant", () => {
    // 2026-10-25 02:30 happens at 00:30Z (CEST) and again at 01:30Z (CET).
    expect(iso(zonedToUtc({ year: 2026, month: 10, day: 25 }, 2 * 60 + 30, TZ))).toBe(
      "2026-10-25T00:30:00.000Z",
    );
  });

  it("works for a zone on the other side of UTC", () => {
    expect(iso(zonedToUtc({ year: 2026, month: 12, day: 24 }, 18 * 60, "America/New_York"))).toBe(
      "2026-12-24T23:00:00.000Z",
    );
  });
});

describe("one-off rule boundary (frozen clock)", () => {
  // 2026-12-24 18:00 to 2026-12-26 23:59, Europe/Belgrade (CET, UTC+1).
  const christmas = rule({
    startsAt: zonedToUtc({ year: 2026, month: 12, day: 24 }, 18 * 60, TZ),
    endsAt: zonedToUtc({ year: 2026, month: 12, day: 26 }, 23 * 60 + 59, TZ),
  });

  it("is the base price at 17:59 Belgrade time", () => {
    const at = new Date("2026-12-24T16:59:00Z");
    expect(resolvePriceAt(target, [christmas], at).ruleId).toBeNull();
  });

  it("is the discounted price from 18:00 Belgrade time", () => {
    const at = new Date("2026-12-24T17:00:00Z");
    const r = resolvePriceAt(target, [christmas], at);
    expect(r.ruleId).toBe(christmas.id);
    expect(r.priceMoney.amounts.rsd).toBe(80004);
  });

  it("is the base price again at the end instant", () => {
    const at = new Date("2026-12-26T22:59:00Z");
    expect(resolvePriceAt(target, [christmas], at).ruleId).toBeNull();
  });
});

describe("weekly recurrence across DST", () => {
  // Every Friday 17:00-21:00 local, from 2026-10-01, no end.
  const friday = rule({
    recurrence: "WEEKLY",
    weekdays: [5],
    startMinute: 17 * 60,
    durationMinutes: 4 * 60,
    startsAt: zonedToUtc({ year: 2026, month: 10, day: 1 }, 0, TZ),
    endsAt: null,
  });

  it("keeps 17:00-21:00 local on both sides of the October switch", () => {
    const got = expandOccurrences(
      friday,
      new Date("2026-10-20T00:00:00Z"),
      new Date("2026-11-03T00:00:00Z"),
    ).map((i) => [iso(i.start), iso(i.end)]);
    expect(got).toEqual([
      // 2026-10-23, CEST (UTC+2)
      ["2026-10-23T15:00:00.000Z", "2026-10-23T19:00:00.000Z"],
      // 2026-10-30, after the 2026-10-25 switch, CET (UTC+1)
      ["2026-10-30T16:00:00.000Z", "2026-10-30T20:00:00.000Z"],
    ]);
  });

  it("keeps 17:00-21:00 local on both sides of the March switch", () => {
    const got = expandOccurrences(
      friday,
      new Date("2027-03-22T00:00:00Z"),
      new Date("2027-04-05T00:00:00Z"),
    ).map((i) => iso(i.start));
    // 2027-03-26 CET, then 2027-04-02 CEST after the 2027-03-28 switch.
    expect(got).toEqual(["2027-03-26T16:00:00.000Z", "2027-04-02T15:00:00.000Z"]);
  });

  it("produces nothing before the series starts", () => {
    expect(
      expandOccurrences(friday, new Date("2026-09-01T00:00:00Z"), new Date("2026-09-30T00:00:00Z")),
    ).toEqual([]);
  });
});

describe("series bounds and clipping", () => {
  it("keeps the last evening of a series even if it runs past midnight", () => {
    const daily = rule({
      recurrence: "DAILY",
      startMinute: 22 * 60,
      durationMinutes: 4 * 60,
      startsAt: zonedToUtc({ year: 2026, month: 11, day: 1 }, 0, TZ),
      // Series ends at the end of 2026-11-02.
      endsAt: zonedToUtc({ year: 2026, month: 11, day: 3 }, 0, TZ),
    });
    const got = expandOccurrences(
      daily,
      new Date("2026-10-31T00:00:00Z"),
      new Date("2026-11-05T00:00:00Z"),
    ).map((i) => [iso(i.start), iso(i.end)]);
    expect(got).toEqual([
      ["2026-11-01T21:00:00.000Z", "2026-11-02T01:00:00.000Z"],
      ["2026-11-02T21:00:00.000Z", "2026-11-03T01:00:00.000Z"],
    ]);
  });

  it("clips an occurrence that is already running at `from`", () => {
    const daily = rule({
      recurrence: "DAILY",
      startMinute: 22 * 60,
      durationMinutes: 4 * 60,
      startsAt: zonedToUtc({ year: 2026, month: 11, day: 1 }, 0, TZ),
      endsAt: null,
    });
    const [first] = expandOccurrences(
      daily,
      new Date("2026-11-02T00:00:00Z"),
      new Date("2026-11-02T12:00:00Z"),
    );
    expect([iso(first.start), iso(first.end)]).toEqual([
      "2026-11-02T00:00:00.000Z",
      "2026-11-02T01:00:00.000Z",
    ]);
  });
});

describe("monthly recurrence", () => {
  it("skips months without that day", () => {
    const the31st = rule({
      recurrence: "MONTHLY",
      monthDay: 31,
      startMinute: 10 * 60,
      durationMinutes: 60,
      startsAt: zonedToUtc({ year: 2026, month: 1, day: 1 }, 0, TZ),
      endsAt: null,
    });
    const days = expandOccurrences(
      the31st,
      new Date("2026-03-15T00:00:00Z"),
      new Date("2026-08-15T00:00:00Z"),
    ).map((i) => iso(i.start).slice(0, 10));
    // March, May, July have a 31st; April and June do not.
    expect(days).toEqual(["2026-03-31", "2026-05-31", "2026-07-31"]);
  });
});
