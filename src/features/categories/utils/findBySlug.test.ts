import { describe, expect, it } from "vitest";
import { findCategoryBySlug } from "./findBySlug";

type Node = { id: string; translations: { slug: string }[]; children: Node[] };
const node = (id: string, slugs: string[], children: Node[] = []): Node => ({
  id,
  translations: slugs.map((slug) => ({ slug })),
  children,
});

const tree = [
  node("fashion", ["fashion", "moda"], [node("shoes", ["shoes", "obuca"])]),
  node("toys", ["toys-kids"]),
];

describe("findCategoryBySlug", () => {
  it("finds a department with no parent", () => {
    const found = findCategoryBySlug(tree, "toys-kids");
    expect(found?.node.id).toBe("toys");
    expect(found?.parent).toBeNull();
  });

  it("finds a subcategory by any locale's slug, with its parent", () => {
    const found = findCategoryBySlug(tree, "obuca");
    expect(found?.node.id).toBe("shoes");
    expect(found?.parent?.id).toBe("fashion");
  });

  it("returns null for a slug the tree does not have", () => {
    expect(findCategoryBySlug(tree, "garden")).toBeNull();
  });
});
