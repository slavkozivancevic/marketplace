import { describe, it, expect } from "vitest";
import { pruneEmptyCategories } from "./pruneEmpty";

type Node = {
  id: string;
  translations: { slug: string }[];
  children: Node[];
};

const node = (id: string, slugs: string[], children: Node[] = []): Node => ({
  id,
  translations: slugs.map((slug) => ({ slug })),
  children,
});

// Electronics holds nothing itself; everything buyable hangs off its children -
// the normal shape of this catalogue, and the case a naive filter breaks.
const TREE: Node[] = [
  node("electronics", ["electronics", "elektronika"], [
    node("laptops", ["laptops", "laptopovi"]),
    node("smart-home", ["smart-home", "pametni-dom"]),
  ]),
  node("fashion", ["fashion", "moda"], [node("shoes", ["shoes", "obuca"])]),
];

const slugsOf = (nodes: Node[]): string[] =>
  nodes.flatMap((n) => [n.id, ...slugsOf(n.children)]);

describe("pruneEmptyCategories", () => {
  it("drops a leaf with no products", () => {
    const out = pruneEmptyCategories(TREE, new Set(["laptops", "shoes"]));
    expect(slugsOf(out)).toEqual(["electronics", "laptops", "fashion", "shoes"]);
  });

  it("keeps a parent whose products all hang off a child", () => {
    const out = pruneEmptyCategories(TREE, new Set(["laptops"]));
    expect(slugsOf(out)).toEqual(["electronics", "laptops"]);
  });

  it("drops a whole branch when nothing under it has products", () => {
    const out = pruneEmptyCategories(TREE, new Set(["shoes"]));
    expect(slugsOf(out)).toEqual(["fashion", "shoes"]);
  });

  it("returns nothing when the catalogue is empty", () => {
    expect(pruneEmptyCategories(TREE, new Set())).toEqual([]);
  });

  it("keeps the browsed category, and its ancestors, even while empty", () => {
    const out = pruneEmptyCategories(TREE, new Set(["laptops"]), "pametni-dom");
    expect(slugsOf(out)).toEqual(["electronics", "laptops", "smart-home"]);
  });

  it("matches keepSlug in any locale", () => {
    const out = pruneEmptyCategories(TREE, new Set(["laptops"]), "smart-home");
    expect(slugsOf(out)).toContain("smart-home");
  });

  it("ignores an absent or empty keepSlug", () => {
    expect(slugsOf(pruneEmptyCategories(TREE, new Set(["laptops"]), ""))).toEqual([
      "electronics",
      "laptops",
    ]);
    expect(
      slugsOf(pruneEmptyCategories(TREE, new Set(["laptops"]), "nepostoji")),
    ).toEqual(["electronics", "laptops"]);
  });

  it("does not mutate the tree it was given", () => {
    const before = JSON.stringify(TREE);
    pruneEmptyCategories(TREE, new Set(["laptops"]));
    expect(JSON.stringify(TREE)).toBe(before);
  });
});
