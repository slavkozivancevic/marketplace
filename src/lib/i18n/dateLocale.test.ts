import { describe, it, expect } from "vitest";
import { dateInSentence, dateLocale } from "./dateLocale";

const SHORT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

const EXPIRY = new Date("2026-09-25T12:00:00Z");

describe("dateInSentence", () => {
  it("drops the trailing period Serbian dates carry", () => {
    // Intl gives "25. sep 2026." - the dot belongs to the date. Dropped into
    // copy that ends in a full stop ("Pozivnica istice {date}."), it produced
    // "2026..".
    const raw = EXPIRY.toLocaleDateString(dateLocale("sr"), SHORT);
    expect(raw.endsWith(".")).toBe(true);
    expect(dateInSentence(EXPIRY, "sr", SHORT)).toBe(raw.slice(0, -1));
  });

  it("leaves a date that does not end in a period alone", () => {
    for (const locale of ["en", "de", "es"]) {
      const raw = EXPIRY.toLocaleDateString(dateLocale(locale), SHORT);
      expect(dateInSentence(EXPIRY, locale, SHORT)).toBe(raw);
    }
  });

  it("strips only the final period, never one inside the date", () => {
    // Serbian short form is "25. sep 2026." - the day's dot must survive.
    expect(dateInSentence(EXPIRY, "sr", SHORT)).toContain("25.");
  });

  it("falls back to the default locale instead of throwing on a bad tag", () => {
    // Intl throws RangeError on a tag it cannot parse, which would take the
    // page down rather than merely look wrong.
    expect(() => dateInSentence(EXPIRY, "", SHORT)).not.toThrow();
    expect(dateInSentence(EXPIRY, "zz", SHORT)).toBe(
      dateInSentence(EXPIRY, "en", SHORT),
    );
  });
});
