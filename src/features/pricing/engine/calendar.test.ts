import { describe, it, expect } from "vitest";
import { buildCalendar, calendarPeriods, findOverlaps, ruleStatus, sameSchedule } from "./calendar";
import { zonedToUtc } from "./timezone";
import { BASE, rule } from "./testRules";

const TZ = "Europe/Belgrade";
const product = { productId: "p1", variantId: null, baseMoney: BASE };

describe("buildCalendar", () => {
  it("marks each local day a rule wins, and nothing else", () => {
    const christmas = rule();
    const [row] = buildCalendar([product], [christmas], { year: 2026, month: 12, day: 23 }, 5, TZ);
    expect(row.days.map((d) => [d.date, d.ruleIds])).toEqual([
      ["2026-12-23", []],
      ["2026-12-24", [christmas.id]],
      ["2026-12-25", [christmas.id]],
      ["2026-12-26", [christmas.id]],
      ["2026-12-27", []],
    ]);
  });

  it("lists both rules on a day that changes hands", () => {
    const morning = rule({
      startsAt: zonedToUtc({ year: 2026, month: 12, day: 1 }, 8 * 60, TZ),
      endsAt: zonedToUtc({ year: 2026, month: 12, day: 1 }, 12 * 60, TZ),
    });
    const evening = rule({
      startsAt: zonedToUtc({ year: 2026, month: 12, day: 1 }, 18 * 60, TZ),
      endsAt: zonedToUtc({ year: 2026, month: 12, day: 1 }, 21 * 60, TZ),
    });
    const [row] = buildCalendar([product], [evening, morning], { year: 2026, month: 12, day: 1 }, 1, TZ);
    expect(row.days[0].ruleIds).toEqual([morning.id, evening.id]);
  });

  it("keeps days aligned across the October DST switch", () => {
    const [row] = buildCalendar([product], [], { year: 2026, month: 10, day: 24 }, 3, TZ);
    expect(row.days.map((d) => d.date)).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
  });
});

describe("findOverlaps", () => {
  const from = new Date("2026-12-01T00:00:00Z");
  const to = new Date("2027-01-01T00:00:00Z");

  it("reports the hidden rule of an overlapping pair", () => {
    const broad = rule({ priority: 1 });
    const flash = rule({ priority: 5 });
    expect(findOverlaps([broad, flash], from, to)).toEqual([{ winnerId: flash.id, hiddenId: broad.id }]);
  });

  it("ignores rules on different variants and paused rules", () => {
    const v1 = rule({ variantId: "v1" });
    const v2 = rule({ variantId: "v2" });
    const paused = rule({ active: false });
    expect(findOverlaps([v1, v2, paused], from, to)).toEqual([]);
  });

  it("treats a product rule and a variant rule as competing for that variant", () => {
    const productRule = rule();
    const variantRule = rule({ variantId: "v1" });
    expect(findOverlaps([productRule, variantRule], from, to)).toEqual([
      { winnerId: variantRule.id, hiddenId: productRule.id },
    ]);
  });

  it("finds nothing when the windows only touch", () => {
    const a = rule({ startsAt: new Date("2026-12-01T10:00:00Z"), endsAt: new Date("2026-12-01T12:00:00Z") });
    const b = rule({ startsAt: new Date("2026-12-01T12:00:00Z"), endsAt: new Date("2026-12-01T14:00:00Z") });
    expect(findOverlaps([a, b], from, to)).toEqual([]);
  });
});

describe("ruleStatus", () => {
  const now = new Date("2026-12-25T00:00:00Z");
  it("orders paused, ended, upcoming, live", () => {
    expect(ruleStatus(rule({ active: false }), now)).toBe("paused");
    expect(ruleStatus(rule({ endsAt: new Date("2026-12-01T00:00:00Z") }), now)).toBe("ended");
    expect(ruleStatus(rule({ startsAt: new Date("2027-01-01T00:00:00Z"), endsAt: null }), now)).toBe(
      "upcoming",
    );
    expect(ruleStatus(rule(), now)).toBe("live");
  });
});

describe("calendarPeriods", () => {
  const day = (date: string, ...ruleIds: string[]) => ({ date, ruleIds });

  it("merges consecutive days with the same rules into one period", () => {
    expect(
      calendarPeriods([day("2026-11-25"), day("2026-11-26"), day("2026-11-27", "bf"), day("2026-11-28", "bf"), day("2026-11-29")]),
    ).toEqual([
      { from: "2026-11-25", to: "2026-11-26", ruleIds: [] },
      { from: "2026-11-27", to: "2026-11-28", ruleIds: ["bf"] },
      { from: "2026-11-29", to: "2026-11-29", ruleIds: [] },
    ]);
  });

  it("starts a new period when a second rule joins on the same day", () => {
    expect(calendarPeriods([day("2026-11-01", "a"), day("2026-11-02", "a", "b")]).map((p) => p.ruleIds)).toEqual([["a"], ["a", "b"]]);
  });

  it("has nothing to say about no days", () => {
    expect(calendarPeriods([])).toEqual([]);
  });
});

describe("sameSchedule", () => {
  const row = (variantId: string | null, ...ids: string[][]) => ({ variantId, days: ids.map((ruleIds, i) => ({ date: `2026-11-0${i + 1}`, ruleIds })) });

  it("is true for rows that price every day alike, whatever the target", () => {
    expect(sameSchedule(row(null, [], ["a"]), row("v1", [], ["a"]))).toBe(true);
  });

  it("is false as soon as one day differs", () => {
    expect(sameSchedule(row(null, [], ["a"]), row("v1", ["b"], ["a"]))).toBe(false);
  });
});
