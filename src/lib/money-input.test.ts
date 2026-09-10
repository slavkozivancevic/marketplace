import { describe, it, expect } from "vitest";
import {
  buildMoneySet,
  emptyMoneyInput,
  moneyInputSchema,
  nonNegativeMoneyInputSchema,
  positiveMoneyInputSchema,
  preserveDerived,
  sameMoneyInput,
  toMoneyInput,
  withOverride,
  withoutOverride,
} from "./money-input";
import { isAuthoredIn, moneyIn, moneyUsdCents, type CurrencyRates } from "./money";

const RATES: CurrencyRates = { usd: 1, eur: 0.921, rsd: 108.5 };

describe("moneyInputSchema", () => {
  it("accepts an integer amount in a supported currency", () => {
    expect(moneyInputSchema.safeParse({ currency: "rsd", amount: 100005 }).success).toBe(true);
  });

  it("rejects a fractional amount - minor units are whole by definition", () => {
    expect(moneyInputSchema.safeParse({ currency: "rsd", amount: 1000.5 }).success).toBe(false);
  });

  it("rejects an unsupported currency", () => {
    expect(moneyInputSchema.safeParse({ currency: "gbp", amount: 100 }).success).toBe(false);
  });

  it("distinguishes positive from non-negative", () => {
    expect(positiveMoneyInputSchema.safeParse({ currency: "usd", amount: 0 }).success).toBe(false);
    expect(nonNegativeMoneyInputSchema.safeParse({ currency: "usd", amount: 0 }).success).toBe(true);
    expect(nonNegativeMoneyInputSchema.safeParse({ currency: "usd", amount: -1 }).success).toBe(false);
  });

  it("accepts per-currency overrides as a partial map", () => {
    const parsed = moneyInputSchema.safeParse({
      currency: "eur",
      amount: 12999,
      overrides: { rsd: 1499900 },
    });
    expect(parsed.success).toBe(true);
  });
});

describe("buildMoneySet", () => {
  it("stores the typed amount exactly and derives the rest", () => {
    const set = buildMoneySet({ currency: "rsd", amount: 100005 }, RATES);
    expect(moneyIn(set, "rsd")).toBe(100005);
    expect(moneyUsdCents(set)).toBe(922);
  });

  it("applies per-currency overrides", () => {
    const set = buildMoneySet(
      { currency: "eur", amount: 12999, overrides: { rsd: 1499900 } },
      RATES,
    );
    expect(moneyIn(set, "eur")).toBe(12999);
    expect(moneyIn(set, "rsd")).toBe(1499900);
    expect(isAuthoredIn(set, "rsd")).toBe(true);
    expect(isAuthoredIn(set, "usd")).toBe(false);
  });

  it("ignores an override for the primary currency, which `amount` already sets", () => {
    const set = buildMoneySet(
      { currency: "eur", amount: 12999, overrides: { eur: 111 } },
      RATES,
    );
    expect(moneyIn(set, "eur")).toBe(12999);
  });
});

describe("toMoneyInput", () => {
  it("round-trips a set back into the form and out again unchanged", () => {
    const original = buildMoneySet(
      { currency: "rsd", amount: 100005, overrides: { eur: 899 } },
      RATES,
    );
    const rebuilt = buildMoneySet(toMoneyInput(original), RATES);
    expect(moneyIn(rebuilt, "rsd")).toBe(100005);
    expect(moneyIn(rebuilt, "eur")).toBe(899);
    expect(moneyIn(rebuilt, "usd")).toBe(moneyIn(original, "usd"));
    expect(rebuilt.primary).toBe("rsd");
  });

  it("reopens the form in the currency the value was entered in", () => {
    const set = buildMoneySet({ currency: "eur", amount: 12999 }, RATES);
    expect(toMoneyInput(set)).toEqual({ currency: "eur", amount: 12999 });
  });

  it("omits an empty overrides map rather than sending an empty object", () => {
    const set = buildMoneySet({ currency: "usd", amount: 500 }, RATES);
    expect("overrides" in toMoneyInput(set)).toBe(false);
  });
});

describe("emptyMoneyInput", () => {
  it("opens blank in the currency on screen", () => {
    expect(emptyMoneyInput("rsd")).toEqual({ currency: "rsd", amount: 0 });
  });
});

describe("withOverride / withoutOverride", () => {
  const base = { currency: "usd", amount: 1005 } as const;

  it("pins a currency", () => {
    expect(withOverride(base, "eur", 899)).toEqual({
      currency: "usd",
      amount: 1005,
      overrides: { eur: 899 },
    });
  });

  it("leaves the other pins alone when removing one", () => {
    const both = withOverride(withOverride(base, "eur", 899), "rsd", 100005);
    expect(withoutOverride(both, "eur")).toEqual({
      currency: "usd",
      amount: 1005,
      overrides: { rsd: 100005 },
    });
  });

  /**
   * The regression that motivated these helpers: pinning a currency and then
   * undoing it left a form permanently flagged as edited. The value LOOKED
   * restored but carried an extra `overrides: undefined` key, and a form
   * library comparing against its defaults key by key does not treat that as
   * equal to a default with no such key.
   */
  it("restores the exact original object when the last pin is removed", () => {
    const pinned = withOverride(base, "eur", 899);
    const restored = withoutOverride(pinned, "eur");

    expect(restored).toEqual(base);
    expect(Object.keys(restored).sort()).toEqual(["amount", "currency"]);
    expect("overrides" in restored).toBe(false);
    // Serialization equality is what a dirty-check ultimately compares.
    expect(JSON.stringify(restored)).toBe(JSON.stringify(base));
  });

  it("is a no-op for a currency that was never pinned", () => {
    expect(withoutOverride(base, "rsd")).toEqual(base);
    expect("overrides" in withoutOverride(base, "rsd")).toBe(false);
  });

  it("round-trips through buildMoneySet unchanged", () => {
    const pinned = withOverride(base, "rsd", 100005);
    const restored = withoutOverride(pinned, "rsd");
    expect(toMoneyInput(buildMoneySet(restored, RATES))).toEqual(base);
  });
});

describe("sameMoneyInput", () => {
  const RSD = buildMoneySet({ currency: "rsd", amount: 100005 }, RATES);

  it("holds for the value a form was seeded with - an untouched field is not an edit", () => {
    expect(sameMoneyInput(toMoneyInput(RSD), toMoneyInput(RSD))).toBe(true);
  });

  it("does not care in which order pins were added", () => {
    const a = withOverride(withOverride(toMoneyInput(RSD), "eur", 899), "usd", 1005);
    const b = withOverride(withOverride(toMoneyInput(RSD), "usd", 1005), "eur", 899);
    expect(sameMoneyInput(a, b)).toBe(true);
  });

  it("treats a missing overrides key and an empty one as the same", () => {
    const base = toMoneyInput(RSD);
    expect(sameMoneyInput(base, { ...base, overrides: {} })).toBe(true);
  });

  it("separates a typed amount, a re-authoring and a new pin from the seed", () => {
    const base = toMoneyInput(RSD);
    expect(sameMoneyInput(base, { ...base, amount: 100000 })).toBe(false);
    expect(sameMoneyInput(base, { ...base, currency: "usd" })).toBe(false);
    expect(sameMoneyInput(base, withOverride(base, "eur", 899))).toBe(false);
  });
});

describe("seeding a form from a stored set", () => {
  it("reopens in the currency the amount is exact in, whatever the screen shows", () => {
    // The pre-fix seed pivoted to the currency in the header, which is what
    // silently moved `primary` on the next save. The seed is now the authoring.
    const set = buildMoneySet({ currency: "rsd", amount: 100005 }, RATES);
    expect(toMoneyInput(set).currency).toBe("rsd");
    expect(toMoneyInput(set).amount).toBe(100005);
  });

  it("re-saves an untouched value as the very same set, to the minor unit", () => {
    for (const amount of [1, 99, 100005, 129900, 1531400]) {
      const original = buildMoneySet({ currency: "rsd", amount }, RATES);
      const resaved = buildMoneySet(toMoneyInput(original), RATES);
      expect(resaved.primary).toBe(original.primary);
      expect(resaved.amounts).toEqual(original.amounts);
    }
  });
});

/**
 * The rule: a save that did not change the price must not re-price the other
 * currencies. Update paths call `buildMoneySet` unconditionally, so without this
 * an edit to a product's description moves what German buyers pay by however
 * much the rate has drifted since the last save.
 */
describe("preserveDerived", () => {
  const LATER: CurrencyRates = { usd: 1, eur: 0.94, rsd: 120 };
  const stored = buildMoneySet({ currency: "rsd", amount: 100005 }, RATES);

  it("keeps the stored set when the authoring is unchanged", () => {
    const rebuilt = buildMoneySet(toMoneyInput(stored), LATER);
    expect(preserveDerived(rebuilt, stored)).toBe(stored);
  });

  it("keeps the rate snapshot too, not just the amounts", () => {
    // The snapshot is what a later refreshDerived would pivot on, so letting it
    // move while the amounts stay put would be a half-updated set.
    const rebuilt = buildMoneySet(toMoneyInput(stored), LATER);
    expect(preserveDerived(rebuilt, stored).rates).toEqual(RATES);
  });

  it("takes the rebuilt set once the amount actually changes", () => {
    const edited = buildMoneySet({ currency: "rsd", amount: 120000 }, LATER);
    const out = preserveDerived(edited, stored);
    expect(out).toBe(edited);
    expect(out.amounts.rsd).toBe(120000);
  });

  it("takes the rebuilt set when the seller re-authors in another currency", () => {
    const edited = buildMoneySet({ currency: "usd", amount: 922 }, LATER);
    expect(preserveDerived(edited, stored)).toBe(edited);
  });

  it("takes the rebuilt set when a per-currency pin is added or dropped", () => {
    const pinned = buildMoneySet(withOverride(toMoneyInput(stored), "eur", 899), LATER);
    expect(preserveDerived(pinned, stored)).toBe(pinned);
    // And back again: dropping the pin is just as much a change.
    const unpinned = buildMoneySet(toMoneyInput(stored), LATER);
    expect(preserveDerived(unpinned, buildMoneySet(withOverride(toMoneyInput(stored), "eur", 899), RATES)))
      .toBe(unpinned);
  });

  it("rebuilds a set that is missing a currency, so the hole heals", () => {
    // Written while the RSD rate was unavailable. Preserving it would keep that
    // gap forever, even though a rate exists now.
    const degraded = buildMoneySet({ currency: "usd", amount: 1005 }, { usd: 1 });
    expect(degraded.amounts.rsd).toBeUndefined();
    const rebuilt = buildMoneySet(toMoneyInput(degraded), RATES);
    const out = preserveDerived(rebuilt, degraded);
    expect(out).toBe(rebuilt);
    expect(out.amounts.rsd).toBeDefined();
  });

  it("takes the rebuilt set when there is nothing stored yet", () => {
    const created = buildMoneySet({ currency: "rsd", amount: 100005 }, RATES);
    expect(preserveDerived(created, null)).toBe(created);
    expect(preserveDerived(created, undefined)).toBe(created);
  });
});
