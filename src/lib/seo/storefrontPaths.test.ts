import { describe, it, expect } from "vitest";
import { isUnservableStorefrontPath, parseEntityDetail } from "./storefrontPaths";

describe("isUnservableStorefrontPath", () => {
  it("rejects extra depth under a storefront segment", () => {
    // The concrete soft-200 measured on staging, plus its siblings.
    for (const path of [
      "/en/products/foo/bar",
      "/en/brands/foo/bar",
      "/en/categories/foo/bar",
      "/sr/proizvodi/foo/bar",
      "/de/marken/a/b/c",
      "/es/categorias/x/y",
    ]) {
      expect(isUnservableStorefrontPath(path), path).toBe(true);
    }
  });

  it("rejects a bare categories path, which has no listing page", () => {
    for (const path of ["/en/categories", "/sr/kategorije", "/de/kategorien", "/es/categorias"]) {
      expect(isUnservableStorefrontPath(path), path).toBe(true);
    }
  });

  it("allows the listing pages that do exist", () => {
    for (const path of [
      "/en/products",
      "/en/brands",
      "/sr/proizvodi",
      "/sr/brendovi",
      "/de/produkte",
      "/es/marcas",
      "/en/products/",
    ]) {
      expect(isUnservableStorefrontPath(path), path).toBe(false);
    }
  });

  it("allows detail URLs so their slug is checked against the database", () => {
    for (const path of [
      "/en/products/some-product",
      "/sr/kategorije/neka-kategorija",
      "/de/marken/eine-marke",
    ]) {
      expect(isUnservableStorefrontPath(path), path).toBe(false);
    }
  });

  it("ignores paths that are not storefront URLs at all", () => {
    for (const path of [
      "/",
      "/en",
      "/en/dashboard/orders/123",
      "/en/admin/products/bulk",
      "/api/products",
      "/sitemap.xml",
    ]) {
      expect(isUnservableStorefrontPath(path), path).toBe(false);
    }
  });

  it("leaves unprefixed URLs to next-intl instead of 404ing them", () => {
    // No locale in front, so the intl middleware still has to redirect these to
    // a locale-prefixed URL - 404ing here would pre-empt that.
    for (const path of ["/products/foo/bar", "/categories", "/proizvodi/a/b"]) {
      expect(isUnservableStorefrontPath(path), path).toBe(false);
    }
  });
});

describe("parseEntityDetail", () => {
  it("parses a localized detail URL", () => {
    expect(parseEntityDetail("/sr/proizvodi/neki-slug")).toEqual({
      kind: "product",
      locale: "sr",
      segment: "proizvodi",
      slug: "neki-slug",
    });
  });

  it("decodes percent-encoded slugs", () => {
    expect(parseEntityDetail("/en/brands/caf%C3%A9")?.slug).toBe("café");
  });

  it("skips legacy uuid URLs, which the page 308-redirects itself", () => {
    expect(
      parseEntityDetail("/en/products/3f2504e0-4f89-11d3-9a0c-0305e82c3301"),
    ).toBeNull();
  });

  it("returns null for anything that is not a three-part storefront URL", () => {
    for (const path of ["/en/products", "/en/products/a/b", "/en/dashboard/orders"]) {
      expect(parseEntityDetail(path), path).toBeNull();
    }
  });
});
