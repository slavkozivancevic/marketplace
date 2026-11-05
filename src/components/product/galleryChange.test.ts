import { describe, it, expect } from "vitest";
import { galleryChange, tileChange } from "./galleryChange";

describe("galleryChange", () => {
  it("is unchanged when keys and order match", () => {
    expect(galleryChange(["a", "b"], ["a", "b"])).toEqual({ changed: false, reordered: false, added: 0, removed: 0 });
  });

  it("calls a swap a reorder, not an add or remove", () => {
    expect(galleryChange(["a", "b"], ["b", "a"])).toEqual({ changed: true, reordered: true, added: 0, removed: 0 });
  });

  it("counts an append as added only - the saved items kept their order", () => {
    expect(galleryChange(["a", "b"], ["a", "b", "c"])).toEqual({ changed: true, reordered: false, added: 1, removed: 0 });
  });

  it("counts a removal, which has no tile left to mark", () => {
    expect(galleryChange(["a", "b", "c"], ["a", "c"])).toEqual({ changed: true, reordered: false, added: 0, removed: 1 });
  });

  it("reports all three at once", () => {
    expect(galleryChange(["a", "b", "c"], ["c", "x", "a"])).toEqual({ changed: true, reordered: true, added: 1, removed: 1 });
  });
});

describe("tileChange", () => {
  it("marks a new tile, a moved tile with its saved position, and leaves an unmoved one alone", () => {
    expect(tileChange(["a", "b"], "x", 0)).toEqual({ kind: "new" });
    expect(tileChange(["a", "b"], "b", 0)).toEqual({ kind: "moved", from: 2 });
    expect(tileChange(["a", "b"], "a", 0)).toBeNull();
  });
});
