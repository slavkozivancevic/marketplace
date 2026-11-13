import { describe, expect, it } from "vitest";
import { productMediaCountHint, rememberProductMediaCount } from "./productPageHint";

describe("productPageHint", () => {
  it("returns the count recorded for a slug", () => {
    rememberProductMediaCount("leather-backpack", 3);
    expect(productMediaCountHint("leather-backpack")).toBe(3);
  });

  it("matches an encoded route param to the raw slug", () => {
    rememberProductMediaCount("kožni-ranac", 1);
    expect(productMediaCountHint(encodeURIComponent("kožni-ranac"))).toBe(1);
  });

  it("has no hint for an unknown slug, a missing slug or a missing count", () => {
    rememberProductMediaCount("no-count", undefined);
    expect(productMediaCountHint("no-count")).toBeUndefined();
    expect(productMediaCountHint("never-seen")).toBeUndefined();
    expect(productMediaCountHint(undefined)).toBeUndefined();
  });
});
