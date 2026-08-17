import { describe, expect, it } from "vitest";

import { pickTranslatedText } from "./translations";

// The whole reason `pickTranslatedText` exists rather than a plain
// `rows.find((r) => r.locale === locale)?.title ?? englishTitle`: a
// translation row can exist for a locale while its display field is blank
// (the row is kept alive by its slug, which can never be empty, or by a
// translated description), and `??` does not fire on "".
describe("pickTranslatedText", () => {
  const rows = [
    { locale: "en", title: "Wireless Mouse" },
    { locale: "sr", title: "" },
    { locale: "de", title: "Kabellose Maus" },
  ];

  it("returns the requested locale's value when it is set", () => {
    expect(pickTranslatedText(rows, "de", "title")).toBe("Kabellose Maus");
  });

  it("falls back to the default locale when the row exists but is blank", () => {
    expect(pickTranslatedText(rows, "sr", "title")).toBe("Wireless Mouse");
  });

  it("falls back to the default locale when no row exists for the locale", () => {
    expect(pickTranslatedText(rows, "es", "title")).toBe("Wireless Mouse");
  });

  it("treats a whitespace-only value as blank", () => {
    expect(
      pickTranslatedText(
        [
          { locale: "en", title: "Wireless Mouse" },
          { locale: "sr", title: "   " },
        ],
        "sr",
        "title",
      ),
    ).toBe("Wireless Mouse");
  });

  it("trims the value it returns", () => {
    expect(
      pickTranslatedText([{ locale: "sr", title: "  Bezicni mis  " }], "sr", "title"),
    ).toBe("Bezicni mis");
  });

  it("falls back to any non-blank row when neither the locale nor the default has one", () => {
    expect(
      pickTranslatedText(
        [
          { locale: "en", title: "" },
          { locale: "de", title: "Kabellose Maus" },
        ],
        "sr",
        "title",
      ),
    ).toBe("Kabellose Maus");
  });

  it("returns an empty string when there is nothing to show", () => {
    const empty: { locale: string; title: string }[] = [];
    expect(pickTranslatedText(empty, "sr", "title")).toBe("");
    expect(pickTranslatedText<{ locale: string; title: string }>(null, "sr", "title")).toBe("");
    expect(pickTranslatedText([{ locale: "en", title: "" }], "sr", "title")).toBe("");
  });
});