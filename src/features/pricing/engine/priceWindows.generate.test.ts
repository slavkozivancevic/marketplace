import { describe, it, expect } from "vitest";
import { buildWindows } from "./windows";
import { BASE, money, rule } from "./testRules";

const FROM = new Date("2026-12-01T00:00:00Z");
const TO = new Date("2027-01-01T00:00:00Z");
const product = { productId: "p1", variantId: null, baseMoney: BASE };
const at = (s: string) => new Date(s);

describe("buildWindows", () => {
  it("returns nothing without rules", () => {
    expect(buildWindows(product, [], FROM, TO)).toEqual([]);
  });

  it("writes the USD mirror together with the set, and the rule's label", () => {
    const r = rule({ name: "Christmas" });
    const [w] = buildWindows(product, [r], FROM, TO);
    expect(w.price).toBe(w.priceMoney.amounts.usd);
    expect(w.ruleLabel).toBe("Christmas");
  });

  it("never overlaps: the higher-priority rule wins the overlap", () => {
    const broad = rule({
      startsAt: at("2026-12-10T00:00:00Z"),
      endsAt: at("2026-12-20T00:00:00Z"),
      percentBps: -1000,
    });
    const flash = rule({
      startsAt: at("2026-12-12T00:00:00Z"),
      endsAt: at("2026-12-13T00:00:00Z"),
      percentBps: -5000,
      priority: 5,
    });
    const got = buildWindows(product, [broad, flash], FROM, TO).map((w) => [
      w.ruleId,
      w.startsAt.toISOString(),
      w.endsAt.toISOString(),
    ]);
    expect(got).toEqual([
      [broad.id, "2026-12-10T00:00:00.000Z", "2026-12-12T00:00:00.000Z"],
      [flash.id, "2026-12-12T00:00:00.000Z", "2026-12-13T00:00:00.000Z"],
      [broad.id, "2026-12-13T00:00:00.000Z", "2026-12-20T00:00:00.000Z"],
    ]);
    for (let i = 1; i < got.length; i++) expect(got[i][1] >= got[i - 1][2]).toBe(true);
  });

  it("merges adjacent stretches won by the same rule", () => {
    const outer = rule({
      startsAt: at("2026-12-10T00:00:00Z"),
      endsAt: at("2026-12-20T00:00:00Z"),
      priority: 9,
    });
    // A lower-priority rule inside it adds boundaries but never wins.
    const inner = rule({ startsAt: at("2026-12-12T00:00:00Z"), endsAt: at("2026-12-13T00:00:00Z") });
    const got = buildWindows(product, [outer, inner], FROM, TO);
    expect(got).toHaveLength(1);
    expect(got[0].endsAt.toISOString()).toBe("2026-12-20T00:00:00.000Z");
  });

  it("lets a variant rule beat a product rule for that variant only", () => {
    const variantBase = money({ usd: 2000, eur: 1800, rsd: 200000 });
    const productRule = rule({ priority: 100 });
    const variantRule = rule({
      variantId: "v1",
      adjustment: "FIXED_PRICE",
      percentBps: null,
      amountMoney: money({ usd: 1500, eur: 1400, rsd: 150000 }),
    });
    const rules = [productRule, variantRule];

    const v1 = buildWindows({ productId: "p1", variantId: "v1", baseMoney: variantBase }, rules, FROM, TO);
    expect(v1.map((w) => w.ruleId)).toEqual([variantRule.id]);

    const v2 = buildWindows({ productId: "p1", variantId: "v2", baseMoney: variantBase }, rules, FROM, TO);
    expect(v2.map((w) => w.ruleId)).toEqual([productRule.id]);

    // The product itself never sees the variant's rule.
    expect(buildWindows(product, rules, FROM, TO).map((w) => w.ruleId)).toEqual([productRule.id]);
  });

  it("applies a product rule to each variant from that variant's own base", () => {
    const r = rule({ percentBps: -2000 });
    const [w] = buildWindows(
      { productId: "p1", variantId: "v2", baseMoney: money({ usd: 2000, eur: 1800, rsd: 200000 }) },
      [r],
      FROM,
      TO,
    );
    expect(w.priceMoney.amounts).toEqual({ usd: 1600, eur: 1440, rsd: 160000 });
  });

  it("leaves region rules to the read path", () => {
    expect(buildWindows(product, [rule({ kind: "REGION", countryCode: "DE" })], FROM, TO)).toEqual([]);
  });

  it("is idempotent: the same input yields the same windows", () => {
    const rules = [
      rule({ recurrence: "DAILY", startMinute: 17 * 60, durationMinutes: 120, endsAt: null }),
      rule({ priority: 3 }),
    ];
    expect(buildWindows(product, rules, FROM, TO)).toEqual(buildWindows(product, rules, FROM, TO));
  });
});
