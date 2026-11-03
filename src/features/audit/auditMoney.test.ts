import { describe, it, expect } from "vitest";
import { currencyShownByMoney, formatAuditMoney } from "./auditMoney";

// Intl puts a narrow no-break space in some locales; compare on plain spaces.
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("formatAuditMoney - money in the audit log reads as money", () => {
  it("formats minor units with the entry's currency in the reader's locale", () => {
    expect(plain(formatAuditMoney(4690965, "rsd", "sr"))).toBe("46.909,65 RSD");
    expect(plain(formatAuditMoney(4690965, "rsd", "en"))).toContain("46,909.65");
  });

  it("keeps the sign of a credit", () => {
    expect(plain(formatAuditMoney(-4413223, "rsd", "sr"))).toBe("-44.132,23 RSD");
  });

  it("never shows the raw integer, even for an older entry without a currency", () => {
    expect(plain(formatAuditMoney(4690965, undefined, "sr"))).toBe("46.909,65");
    expect(plain(formatAuditMoney(4690965, "xyz", "en"))).toBe("46,909.65");
  });
});

describe("currencyShownByMoney", () => {
  it("drops the separate currency item once an amount carries it", () => {
    expect(currencyShownByMoney({ amount: 100, currency: "rsd" })).toBe(true);
    expect(currencyShownByMoney({ currency: "rsd", settled: "x" })).toBe(false);
    expect(currencyShownByMoney({ amount: 100 })).toBe(false);
  });
});
