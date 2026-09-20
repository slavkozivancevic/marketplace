import { describe, expect, it } from "vitest";
import { copyName } from "./copyName";

describe("copyName", () => {
  it("prefixes in the row's own locale", () => {
    expect(copyName("en", "Sneakers")).toBe("Copy of Sneakers");
    expect(copyName("sr", "Patike")).toBe("Kopija od Patike");
    expect(copyName("de", "Turnschuhe")).toBe("Kopie von Turnschuhe");
    expect(copyName("es", "Zapatillas")).toBe("Copia de Zapatillas");
  });

  it("falls back to the default locale for an unknown one", () => {
    expect(copyName("fr", "Baskets")).toBe("Copy of Baskets");
  });

  it("stacks on a copy of a copy, the way a file manager names copies", () => {
    expect(copyName("sr", copyName("sr", "Patike"))).toBe("Kopija od Kopija od Patike");
  });

  it("leaves a name alone when no limit is given", () => {
    expect(copyName("en", "x".repeat(200))).toHaveLength(208);
  });

  it("clips the name, not the prefix, to stay inside maxLength", () => {
    const result = copyName("sr", "P".repeat(200), 100);
    expect(result).toHaveLength(100);
    expect(result.startsWith("Kopija od ")).toBe(true);
  });

  it("does not leave the clip ending in a space", () => {
    // Room runs out mid-space: "Copy of Nike " would read as a trailing blank.
    const result = copyName("en", "Nike Air", "Copy of Nike ".length);
    expect(result).toBe("Copy of Nike");
  });

  it("a chain of copies stays inside maxLength", () => {
    let name = "Patike";
    for (let i = 0; i < 20; i++) {
      name = copyName("sr", name, 100);
      expect(name.length).toBeLessThanOrEqual(100);
    }
  });
});
