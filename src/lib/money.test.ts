import { describe, it, expect } from "vitest";
import {
  authorMoney,
  clearAuthoredAmount,
  decimalToMinor,
  deriveMinor,
  isAuthoredIn,
  minorToDecimal,
  MissingMoneySetError,
  MissingRateError,
  moneyIn,
  moneyUsdCents,
  parseMoney,
  refreshDerived,
  requireMoney,
  serializeMoney,
  setAuthoredAmount,
  zeroMoney,
  type CurrencyRates,
} from "./money";
import { formatPrice } from "./currency";
import { VALID_CURRENCIES, type Currency } from "./currency-config";

/** The rates the rest of the suite uses, so examples stay comparable. */
const RATES: CurrencyRates = { usd: 1, eur: 0.921, rsd: 108.5 };

describe("deriveMinor", () => {
  it("returns the amount unchanged for the same currency", () => {
    expect(deriveMinor(100005, "rsd", "rsd", RATES)).toBe(100005);
  });

  it("converts para to cents", () => {
    // 1000.05 RSD / 108.5 = 9.21705 USD
    expect(deriveMinor(100005, "rsd", "usd", RATES)).toBe(922);
  });

  it("rounds a derived RSD amount to the para, not to a whole dinar", () => {
    // 129.99 EUR -> 141.14006 USD -> 15313.6967 RSD. Rounding this to 15314 din
    // discarded 30 para of a price the seller never typed, so it no longer does.
    expect(deriveMinor(12999, "eur", "rsd", RATES)).toBe(1531370);
  });

  it("rounds a derived EUR amount to the cent", () => {
    expect(deriveMinor(100005, "rsd", "eur", RATES)).toBe(849);
  });

  it("returns null when a rate is missing rather than guessing", () => {
    expect(deriveMinor(100005, "rsd", "usd", { usd: 1 })).toBeNull();
    expect(deriveMinor(1000, "usd", "rsd", { usd: 1 })).toBeNull();
  });
});

describe("authorMoney", () => {
  it("keeps the typed amount verbatim and derives the rest", () => {
    const set = authorMoney(100005, "rsd", RATES);
    expect(set.primary).toBe("rsd");
    expect(set.amounts.rsd).toBe(100005);
    expect(set.amounts.usd).toBe(922);
    expect(set.amounts.eur).toBe(849);
    expect(set.authored).toEqual(["rsd"]);
  });

  it("never rounds the authored currency to the derived step", () => {
    // 1000.05 RSD would round to a whole dinar if it were derived. It is not.
    const set = authorMoney(100005, "rsd", RATES);
    expect(set.amounts.rsd).toBe(100005);
    expect(set.amounts.rsd! % 100).not.toBe(0);
  });

  it("throws instead of storing a wrong mirror when the rate is missing", () => {
    expect(() => authorMoney(100005, "rsd", { usd: 1 })).toThrow(MissingRateError);
  });

  it("snapshots the rates it used", () => {
    expect(authorMoney(12999, "eur", RATES).rates).toEqual(RATES);
  });
});

describe("the bug this module exists to prevent", () => {
  it("reads back exactly what was typed, in every currency", () => {
    for (const currency of VALID_CURRENCIES) {
      for (const typed of [1, 5, 99, 100, 12999, 100005, 999999]) {
        const set = authorMoney(typed, currency, RATES);
        expect(moneyIn(set, currency)).toBe(typed);
      }
    }
  });

  it("survives a full round trip through the Json column", () => {
    const set = authorMoney(100005, "rsd", RATES);
    const back = parseMoney(JSON.parse(JSON.stringify(serializeMoney(set))));
    expect(back).not.toBeNull();
    expect(moneyIn(back!, "rsd")).toBe(100005);
    expect(back!.primary).toBe("rsd");
    expect(back!.authored).toEqual(["rsd"]);
  });

  it("does not move when the exchange rate does", () => {
    const set = authorMoney(100005, "rsd", RATES);
    const laterRates: CurrencyRates = { usd: 1, eur: 0.94, rsd: 111.0 };
    // A read is handed live rates and must still ignore them for a stored entry.
    expect(moneyIn(set, "rsd", laterRates)).toBe(100005);
    expect(formatPrice(moneyIn(set, "rsd", laterRates), "rsd", "sr")).toMatch(/1\.000,05/);
  });

  it("formats the old failing case correctly", () => {
    // Previously: 1000.05 RSD -> 922 cents -> back to 1000.37 RSD.
    const set = authorMoney(100005, "rsd", RATES);
    expect(formatPrice(moneyIn(set, "rsd"), "rsd", "sr")).toMatch(/1\.000,05/);
  });

  it("keeps whole-dinar prices whole", () => {
    const set = authorMoney(100000, "rsd", RATES);
    expect(formatPrice(moneyIn(set, "rsd"), "rsd", "sr")).toMatch(/1\.000,00/);
  });
});

describe("per-currency overrides", () => {
  it("pins one currency without disturbing the others", () => {
    const set = authorMoney(12999, "eur", RATES);
    const pinned = setAuthoredAmount(set, "rsd", 1499900, RATES);
    expect(moneyIn(pinned, "rsd")).toBe(1499900);
    expect(moneyIn(pinned, "eur")).toBe(12999);
    expect(moneyIn(pinned, "usd")).toBe(set.amounts.usd);
    expect(isAuthoredIn(pinned, "rsd")).toBe(true);
    expect(isAuthoredIn(pinned, "usd")).toBe(false);
  });

  it("re-derives the unpinned currencies when the primary changes", () => {
    const set = setAuthoredAmount(authorMoney(12999, "eur", RATES), "rsd", 1499900, RATES);
    const edited = setAuthoredAmount(set, "eur", 9999, RATES);
    expect(moneyIn(edited, "eur")).toBe(9999);
    // rsd stays pinned, usd follows the new primary.
    expect(moneyIn(edited, "rsd")).toBe(1499900);
    expect(moneyIn(edited, "usd")).toBe(deriveMinor(9999, "eur", "usd", RATES));
  });

  it("puts a cleared override back on the derived path", () => {
    const set = setAuthoredAmount(authorMoney(12999, "eur", RATES), "rsd", 1499900, RATES);
    const cleared = clearAuthoredAmount(set, "rsd", RATES);
    expect(isAuthoredIn(cleared, "rsd")).toBe(false);
    expect(moneyIn(cleared, "rsd")).toBe(deriveMinor(12999, "eur", "rsd", RATES));
  });

  it("refuses to clear the primary currency", () => {
    const set = authorMoney(12999, "eur", RATES);
    expect(clearAuthoredAmount(set, "eur", RATES)).toEqual(set);
  });
});

describe("refreshDerived", () => {
  it("moves derived amounts to the new rates and leaves authored ones alone", () => {
    const set = setAuthoredAmount(authorMoney(12999, "eur", RATES), "rsd", 1499900, RATES);
    const newRates: CurrencyRates = { usd: 1, eur: 0.94, rsd: 111.0 };
    const refreshed = refreshDerived(set, newRates);
    expect(moneyIn(refreshed, "eur")).toBe(12999);
    expect(moneyIn(refreshed, "rsd")).toBe(1499900);
    expect(moneyIn(refreshed, "usd")).toBe(deriveMinor(12999, "eur", "usd", newRates));
    expect(refreshed.rates).toEqual(newRates);
  });
});

describe("moneyIn fallback", () => {
  it("derives from the USD mirror for a currency the set never stored", () => {
    const set = authorMoney(1000, "usd", { usd: 1 });
    expect(set.amounts.rsd).toBeUndefined();
    expect(moneyIn(set, "rsd", RATES)).toBe(deriveMinor(1000, "usd", "rsd", RATES));
  });

  it("returns 0 rather than throwing when there is nothing to go on", () => {
    const set = { primary: "usd" as Currency, amounts: {}, authored: ["usd" as Currency], rates: {} };
    expect(moneyIn(set, "rsd")).toBe(0);
  });
});

describe("parseMoney", () => {
  it("returns null when the column holds nothing", () => {
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney(undefined)).toBeNull();
  });

  it("returns null on malformed Json rather than improvising a set", () => {
    // It used to rebuild a USD-only set from the mirror column here. That made a
    // corrupt set indistinguishable from a legitimately USD-priced one, which is
    // how a currency bug hides. The money columns are NOT NULL now, so there is
    // nothing left to rescue and the honest answer is "this is not a set".
    expect(parseMoney({ primary: "xyz" })).toBeNull();
    expect(parseMoney("not an object")).toBeNull();
    expect(parseMoney([1, 2, 3])).toBeNull();
    // Primary present but its amount missing - unusable.
    expect(parseMoney({ primary: "rsd", amounts: { usd: 5 } })).toBeNull();
  });

  it("repairs an authored list that lost its primary", () => {
    const set = parseMoney({ primary: "rsd", amounts: { rsd: 100005 }, authored: [] });
    expect(set!.authored).toContain("rsd");
  });
});

describe("requireMoney", () => {
  it("returns the set for a column that holds one", () => {
    const stored = JSON.parse(JSON.stringify(serializeMoney(authorMoney(100005, "rsd", RATES))));
    expect(moneyIn(requireMoney(stored, "Product.priceMoney"), "rsd")).toBe(100005);
  });

  it("throws, naming the column, when the contract is broken", () => {
    expect(() => requireMoney(null, "Product.priceMoney on p1")).toThrow(MissingMoneySetError);
    expect(() => requireMoney({ primary: "xyz" }, "Product.priceMoney on p1")).toThrow(
      /Product\.priceMoney on p1/,
    );
  });
});

describe("zeroMoney", () => {
  it("is zero in every currency without needing a rate", () => {
    const zero = zeroMoney();
    expect(moneyIn(zero, "usd")).toBe(0);
    expect(moneyIn(zero, "eur")).toBe(0);
    expect(moneyIn(zero, "rsd")).toBe(0);
  });
});

describe("moneyUsdCents", () => {
  it("is the value the indexed mirror column stores", () => {
    expect(moneyUsdCents(authorMoney(100005, "rsd", RATES))).toBe(922);
  });
});

describe("minorToDecimal / decimalToMinor", () => {
  it("round-trips a form value in every currency", () => {
    for (const currency of VALID_CURRENCIES) {
      for (const minor of [1, 99, 100, 12999, 100005]) {
        expect(decimalToMinor(minorToDecimal(minor, currency), currency)).toBe(minor);
      }
    }
  });

  it("rounds a sub-minor float out of an input", () => {
    expect(decimalToMinor(29.999, "usd")).toBe(3000);
  });
});

/**
 * The backfill migration (20260906120000_backfill_money_sets) reimplemented this
 * derivation in SQL, because a data migration must stay reproducible and so
 * cannot import application code. It ran while RSD was rounded to a whole dinar,
 * and an applied migration is never edited, so the rows it wrote keep that
 * rounding until the product is next saved.
 *
 * These pin both formulas, so the divergence stays a stated, bounded one (up to
 * 50 para on a backfilled RSD amount) rather than something rediscovered later.
 */
describe("derivation, and what the backfill migration wrote", () => {
  const cases = [1, 99, 100, 922, 2999, 14114, 999999];

  it("eur = round(usdCents * eurRate) - unchanged from the migration", () => {
    for (const usdCents of cases) {
      expect(deriveMinor(usdCents, "usd", "eur", RATES)).toBe(
        Math.round(usdCents * RATES.eur),
      );
    }
  });

  it("rsd = round(usdCents * rsdRate), to the para", () => {
    for (const usdCents of cases) {
      expect(deriveMinor(usdCents, "usd", "rsd", RATES)).toBe(
        Math.round(usdCents * RATES.rsd),
      );
    }
  });

  it("differs from the backfilled value by less than a dinar", () => {
    for (const usdCents of cases) {
      const backfilled = Math.round((usdCents * RATES.rsd) / 100) * 100;
      expect(Math.abs(deriveMinor(usdCents, "usd", "rsd", RATES)! - backfilled)).toBeLessThan(100);
    }
  });
});
