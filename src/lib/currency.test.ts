import { describe, it, expect } from "vitest";
import {
  getCurrencyConfig,
  formatPrice,
  convertCents,
  centsToDecimal,
  decimalToCents,
} from "./currency";
import type { Currency } from "./currency-config";

describe("getCurrencyConfig", () => {
  it("returns the config for a known currency", () => {
    expect(getCurrencyConfig("eur").symbol).toBe("€");
  });

  it("falls back to USD for an unknown currency", () => {
    expect(getCurrencyConfig("gbp" as Currency).code).toBe("usd");
  });
});

describe("formatPrice", () => {
  it("formats USD cents with the dollar symbol", () => {
    expect(formatPrice(2999, "usd", "en")).toBe("$29.99");
  });

  it("formats EUR with a comma decimal and the euro symbol", () => {
    const out = formatPrice(2761, "eur", "de");
    expect(out).toMatch(/27,61/);
    expect(out).toContain("€");
  });

  it("formats RSD with grouped thousands and the RSD code", () => {
    const out = formatPrice(325392, "rsd", "sr");
    expect(out).toMatch(/3\.253,92/);
    expect(out).toContain("RSD");
  });

  /**
   * The reason the locale is a parameter at all. Grouping and the decimal mark
   * belong to whoever is READING the number, not to the currency it is in - a
   * dinar price rendered in sr-RS for an English speaker reads "3.253" as three
   * point two five three.
   */
  it("writes the number the way the reader's language writes numbers", () => {
    // Whitespace is normalised: Intl separates the code from the number with a
    // non-breaking space, which is its business and not something to pin here.
    const plain = (s: string) => s.replace(/\s/g, " ");
    expect(plain(formatPrice(325392, "rsd", "en"))).toBe("RSD 3,253.92");
    expect(plain(formatPrice(325392, "rsd", "sr"))).toBe("3.253,92 RSD");
  });

  it("uses the narrow symbol, so USD outside en is a $ and not US$", () => {
    for (const locale of ["sr", "de", "es"]) {
      const out = formatPrice(2999, "usd", locale);
      expect(out).toContain("$");
      expect(out).not.toContain("US$");
      expect(out).toMatch(/29,99/);
    }
  });

  it("keeps the thousands separator in es, which drops it by default", () => {
    // es-ES omits the group separator on four-digit numbers unless asked. On a
    // price that reads as a tenfold error, so grouping is forced on.
    expect(formatPrice(325392, "rsd", "es")).toMatch(/3\.253,92/);
  });

  it("falls back instead of throwing on a locale Intl cannot parse", () => {
    // An empty or stale locale must not take the page down with a RangeError.
    expect(() => formatPrice(2999, "usd", "")).not.toThrow();
    expect(formatPrice(2999, "usd", "zz")).toBe(formatPrice(2999, "usd", "en"));
  });
});

describe("convertCents", () => {
  it("returns USD cents unchanged", () => {
    expect(convertCents(2999, "usd", 1)).toBe(2999);
  });

  it("applies the rate and rounds for a foreign currency", () => {
    expect(convertCents(2999, "eur", 0.921)).toBe(2762);
    expect(convertCents(2999, "rsd", 108.5)).toBe(325392);
  });
});

describe("centsToDecimal / decimalToCents", () => {
  it("converts cents to a decimal", () => {
    expect(centsToDecimal(2999)).toBe(29.99);
  });

  it("converts a decimal to cents", () => {
    expect(decimalToCents(29.99)).toBe(2999);
  });

  it("rounds sub-cent decimals to the nearest cent", () => {
    expect(decimalToCents(29.999)).toBe(3000);
  });

  it("round-trips cleanly", () => {
    expect(decimalToCents(centsToDecimal(12345))).toBe(12345);
  });
});
