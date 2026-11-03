import { describe, it, expect } from "vitest";
import { formatNumber, formatRating } from "./numbers";

describe("numbers in the app locale, not the browser's", () => {
  it("groups thousands the reader's way", () => {
    expect(formatNumber(1250, "sr")).toBe("1.250");
    expect(formatNumber(1250, "en")).toBe("1,250");
    expect(formatNumber(1250, "de")).toBe("1.250");
  });

  it("writes a rating with one decimal and the reader's decimal mark", () => {
    expect(formatRating(4, "sr")).toBe("4,0");
    expect(formatRating(4.25, "en")).toBe("4.3");
    expect(formatRating(3.5, "es")).toBe("3,5");
  });
});
