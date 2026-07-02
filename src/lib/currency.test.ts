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
    expect(formatPrice(2999, "usd")).toBe("$29.99");
  });

  it("formats EUR with a comma decimal and the euro symbol", () => {
    const out = formatPrice(2761, "eur");
    expect(out).toMatch(/27,61/);
    expect(out).toContain("€");
  });

  it("formats RSD with grouped thousands and the RSD code", () => {
    const out = formatPrice(325392, "rsd");
    expect(out).toMatch(/3\.253,92/);
    expect(out).toContain("RSD");
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
