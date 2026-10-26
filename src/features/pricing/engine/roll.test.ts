import { describe, it, expect } from "vitest";
import { rollTarget, lowestBefore, type LedgerPoint } from "./roll";
import { BASE, money, rule } from "./testRules";

const start = new Date("2026-12-24T17:00:00Z");
const end = new Date("2026-12-26T22:59:00Z");
const DAY = 86_400_000;
const daysBefore = (n: number) => new Date(start.getTime() - n * DAY);

/** The base price as an open ledger point since long before the promo. */
const baseOnly: LedgerPoint[] = [{ priceMoney: BASE, startedAt: daysBefore(90), endedAt: null }];
const sellerCompareAt = money({ usd: 1500, eur: 1400, rsd: 150000 });

describe("rollTarget without a window", () => {
  it("is exactly the base price and the seller's compare-at", () => {
    const next = new Date("2027-01-01T00:00:00Z");
    expect(
      rollTarget({
        base: { priceMoney: BASE, compareAtMoney: sellerCompareAt },
        active: null,
        nextStart: next,
        points: baseOnly,
      }),
    ).toEqual({
      priceMoney: BASE,
      compareAtMoney: sellerCompareAt,
      ruleId: null,
      ruleLabel: null,
      until: next,
      since: null,
    });
  });

  it("is valid indefinitely when no window is coming", () => {
    const s = rollTarget({
      base: { priceMoney: BASE, compareAtMoney: null },
      active: null,
      nextStart: null,
      points: baseOnly,
    });
    expect(s.until).toBeNull();
  });
});

describe("rollTarget with a window", () => {
  const r = rule({ name: "Christmas" });
  const active = { rule: r, startsAt: start, endsAt: end };

  it("prices from the current base and names the rule", () => {
    const s = rollTarget({
      base: { priceMoney: BASE, compareAtMoney: sellerCompareAt },
      active,
      nextStart: null,
      points: baseOnly,
    });
    expect(s.priceMoney.amounts).toEqual({ usd: 879, eur: 799, rsd: 80004 });
    expect(s.ruleId).toBe(r.id);
    // The Omnibus lookback of a market price is anchored here.
    expect(s.since).toBe(start);
    expect(s.ruleLabel).toBe("Christmas");
    expect(s.until).toEqual(end);
  });

  it("strikes through the lowest price of the 30 days before, not the seller's compare-at", () => {
    const s = rollTarget({
      base: { priceMoney: BASE, compareAtMoney: sellerCompareAt },
      active,
      nextStart: null,
      points: baseOnly,
    });
    expect(s.compareAtMoney?.amounts).toEqual(BASE.amounts);
  });

  it("ends at the next window when that starts before this one ends", () => {
    const next = new Date("2026-12-25T00:00:00Z");
    const s = rollTarget({
      base: { priceMoney: BASE, compareAtMoney: null },
      active,
      nextStart: next,
      points: baseOnly,
    });
    expect(s.until).toEqual(next);
  });

  it("falls back to the base price when the rule's result is not sellable", () => {
    const broken = rule({
      adjustment: "AMOUNT_OFF",
      percentBps: null,
      amountMoney: money({ usd: 99999, eur: 99999, rsd: 9999999 }),
    });
    const s = rollTarget({
      base: { priceMoney: BASE, compareAtMoney: sellerCompareAt },
      active: { rule: broken, startsAt: start, endsAt: end },
      nextStart: null,
      points: baseOnly,
    });
    expect(s.priceMoney).toBe(BASE);
    expect(s.compareAtMoney).toBe(sellerCompareAt);
    expect(s.ruleId).toBeNull();
    expect(s.since).toBeNull();
  });

  it("drops the strike-through when an earlier promo inside the 30 days was as low", () => {
    // Last week's identical promo sits in the ledger, 7 days before this one.
    const lastWeek = money({ usd: 879, eur: 799, rsd: 80004 });
    const points: LedgerPoint[] = [
      { priceMoney: BASE, startedAt: daysBefore(90), endedAt: daysBefore(7) },
      { priceMoney: lastWeek, startedAt: daysBefore(7), endedAt: daysBefore(6) },
      { priceMoney: BASE, startedAt: daysBefore(6), endedAt: null },
    ];
    const s = rollTarget({
      base: { priceMoney: BASE, compareAtMoney: null },
      active,
      nextStart: null,
      points,
    });
    expect(s.priceMoney.amounts.rsd).toBe(80004);
    expect(s.compareAtMoney).toBeNull();
  });

  it("strikes through again once that earlier promo is older than 30 days", () => {
    const old = money({ usd: 500, eur: 450, rsd: 50000 });
    const points: LedgerPoint[] = [
      { priceMoney: old, startedAt: daysBefore(40), endedAt: daysBefore(31) },
      { priceMoney: BASE, startedAt: daysBefore(31), endedAt: null },
    ];
    const s = rollTarget({
      base: { priceMoney: BASE, compareAtMoney: null },
      active,
      nextStart: null,
      points,
    });
    expect(s.compareAtMoney?.amounts).toEqual(BASE.amounts);
  });
});

describe("lowestBefore", () => {
  it("takes the minimum per currency independently", () => {
    const a = money({ usd: 1000, eur: 900, rsd: 120000 });
    const b = money({ usd: 1100, eur: 850, rsd: 110000 });
    const got = lowestBefore(
      [
        { priceMoney: a, startedAt: daysBefore(20), endedAt: daysBefore(10) },
        { priceMoney: b, startedAt: daysBefore(10), endedAt: null },
      ],
      start,
      BASE,
    );
    expect(got.amounts).toEqual({ usd: 1000, eur: 850, rsd: 110000 });
  });

  it("ignores points that started at or after the reduction", () => {
    const later = money({ usd: 1, eur: 1, rsd: 1 });
    const got = lowestBefore(
      [
        { priceMoney: BASE, startedAt: daysBefore(5), endedAt: start },
        { priceMoney: later, startedAt: start, endedAt: null },
      ],
      start,
      BASE,
    );
    expect(got.amounts).toEqual(BASE.amounts);
  });

  it("falls back to the base price with no history", () => {
    expect(lowestBefore([], start, BASE)).toBe(BASE);
  });
});
