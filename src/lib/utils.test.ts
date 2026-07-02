import { describe, it, expect } from "vitest";
import { slugify } from "./utils";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips diacritics to ASCII", () => {
    expect(slugify("Čizme za Sneg")).toBe("cizme-za-sneg");
  });

  it("drops punctuation and symbols", () => {
    expect(slugify("Nike Air Max 90!")).toBe("nike-air-max-90");
  });

  it("collapses runs of whitespace and hyphens", () => {
    expect(slugify("  a  --  b  ")).toBe("a-b");
  });

  it("returns an empty string for symbol-only input", () => {
    expect(slugify("!!!")).toBe("");
  });
});
