import { describe, expect, it } from "vitest";
import { deriveOrRestore } from "./deriveOrRestore";
import { slugify } from "@/lib/utils";

/**
 * The live "typing a name fills the slug" contract, exercised with the real
 * `slugify` the forms pass in. Every admin form pairs these two the same way
 * (ProductForm title/slug, Brand/Category/Tag name/slug, Attribute label/key),
 * so a regression here is a regression in all five at once.
 */
describe("deriveOrRestore - name to slug", () => {
  const derive = (current: string, savedSource?: string, savedDerived?: string) =>
    deriveOrRestore(current, savedSource, savedDerived, slugify);

  it("fills the slug while typing a new record's name", () => {
    // Create mode: no saved baseline, so every keystroke derives.
    expect(derive("N")).toBe("n");
    expect(derive("Nike")).toBe("nike");
    expect(derive("Nike Air Max")).toBe("nike-air-max");
  });

  it("keeps deriving as an existing record's name is edited", () => {
    expect(derive("Nike Air Max", "Nike Air", "nike-air")).toBe("nike-air-max");
  });

  it("restores the SAVED slug when the name is typed back to its baseline", () => {
    // Not `slugify("Nike Air")`: the saved slug may carry a uniqueness suffix
    // the record actually owns. Re-deriving here left the field permanently
    // "changed" and made regeneration collide with the record's own slug.
    expect(derive("Nike Air", "Nike Air", "nike-air-2")).toBe("nike-air-2");
  });

  it("restores a duplicate's copy-marked slug rather than collapsing it", () => {
    // A duplicate is saved as title "Copy of Nike Air" with slug
    // "nike-air-copy-m9x2ab". Opening its edit form must show that slug, not
    // slugify("Copy of Nike Air").
    expect(
      derive("Copy of Nike Air", "Copy of Nike Air", "nike-air-copy-m9x2ab"),
    ).toBe("nike-air-copy-m9x2ab");
    expect(derive("Copy of Nike Air", "Copy of Nike Air", "nike-air-copy-m9x2ab")).not.toBe(
      slugify("Copy of Nike Air"),
    );
  });

  it("derives from the new name once the duplicate is renamed", () => {
    expect(
      derive("Nike Air Europe", "Copy of Nike Air", "nike-air-copy-m9x2ab"),
    ).toBe("nike-air-europe");
  });

  it("strips diacritics, so a Serbian name still yields a URL-safe slug", () => {
    expect(derive("Patike Nike Vazdušne")).toBe("patike-nike-vazdusne");
  });

  it("empties the slug when the name is cleared back to an empty baseline", () => {
    expect(derive("", "", "")).toBe("");
    expect(derive("", undefined, undefined)).toBe("");
  });
});
