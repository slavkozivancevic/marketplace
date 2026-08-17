import { describe, it, expect } from "vitest";
import { __valuesEqualForTests as valuesEqual } from "./useIsFormDirty";

describe("valuesEqual (unsaved-changes comparison)", () => {
  it("treats a cleared translated title+slug as back-to-baseline", () => {
    // The exact shape that kept the save bar lit: the user typed into an empty
    // per-locale title (which auto-derives the slug) and then deleted it again.
    const baseline = {
      title: "product title",
      translations: { sr: { title: "", slug: "" }, de: { title: "", slug: "" } },
    };
    const afterTypingThenDeleting = {
      title: "product title",
      translations: { sr: { title: "", slug: "" }, de: { title: "", slug: "" } },
    };
    expect(valuesEqual(afterTypingThenDeleting, baseline)).toBe(true);
  });

  it("still reports a real edit while the field holds text", () => {
    const baseline = { translations: { sr: { title: "", slug: "" } } };
    const typing = { translations: { sr: { title: "j", slug: "j" } } };
    expect(valuesEqual(typing, baseline)).toBe(false);
  });

  it("does not confuse null / undefined / missing keys with a change", () => {
    expect(valuesEqual({ a: null }, { a: undefined })).toBe(true);
    expect(valuesEqual({ a: null }, {})).toBe(true);
    expect(valuesEqual({ brandId: undefined }, {})).toBe(true);
  });

  it("treats clearing real text to an empty string as a change", () => {
    // "" must NOT be lumped in with null/undefined - wiping a field is an edit.
    expect(valuesEqual({ a: "" }, { a: "text" })).toBe(false);
    expect(valuesEqual({ a: "" }, { a: null })).toBe(false);
  });

  it("compares arrays by order and content", () => {
    expect(valuesEqual({ ids: ["a", "b"] }, { ids: ["a", "b"] })).toBe(true);
    expect(valuesEqual({ ids: ["b", "a"] }, { ids: ["a", "b"] })).toBe(false);
    expect(valuesEqual({ ids: ["a"] }, { ids: ["a", "b"] })).toBe(false);
  });

  it("compares nested media/variant rows structurally", () => {
    const saved = { media: [{ key: "m1", thumbKey: null, width: null }] };
    const reseeded = { media: [{ key: "m1", thumbKey: null, width: null }] };
    expect(valuesEqual(reseeded, saved)).toBe(true);

    const edited = { media: [{ key: "m2", thumbKey: null, width: null }] };
    expect(valuesEqual(edited, saved)).toBe(false);
  });

  it("compares numbers and booleans by value", () => {
    expect(valuesEqual({ price: 10, taxable: true }, { price: 10, taxable: true })).toBe(true);
    expect(valuesEqual({ price: 10 }, { price: 11 })).toBe(false);
    expect(valuesEqual({ taxable: false }, { taxable: true })).toBe(false);
  });

  it("compares dates by timestamp, not identity", () => {
    expect(valuesEqual({ d: new Date(1000) }, { d: new Date(1000) })).toBe(true);
    expect(valuesEqual({ d: new Date(1000) }, { d: new Date(2000) })).toBe(false);
  });
});
