import { describe, it, expect } from "vitest";
import {
  ENTITY_SEGMENTS,
  isUnservableStorefrontPath,
  localizedSegment,
  parseEntityDetail,
} from "./storefrontPaths";

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

  it("rejects a detail slug with malformed percent-encoding", () => {
    // decodeURIComponent throws URIError on these. Handling them on the URL
    // alone keeps them out of the database path and out of the 500s that an
    // uncaught throw in the proxy would produce.
    for (const path of ["/en/products/%", "/sr/proizvodi/caf%C3", "/de/marken/%E0%A4%A"]) {
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

  it("does not treat inherited Object members as storefront segments", () => {
    // `ENTITY_SEGMENTS[segment]` would resolve these off the prototype, hand
    // back a truthy kind outside the union, and buy a needless Neon-waking
    // query. `/en/valueOf` must be an ordinary unknown path, not a bare
    // listing miss.
    for (const path of ["/en/valueOf", "/en/constructor/x", "/en/toString/a/b"]) {
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
      isId: false,
    });
  });

  it("decodes percent-encoded slugs", () => {
    expect(parseEntityDetail("/en/brands/caf%C3%A9")?.slug).toBe("café");
  });

  it("returns null for malformed percent-encoding instead of throwing", () => {
    // parseEntityDetail runs in the proxy outside any try/catch, so a throw
    // here is a 500 on exactly the junk URLs this module answers with a 404.
    for (const path of ["/en/products/%", "/sr/proizvodi/caf%C3", "/de/marken/%E0%A4%A"]) {
      expect(() => parseEntityDetail(path), path).not.toThrow();
      expect(parseEntityDetail(path), path).toBeNull();
    }
  });

  it("flags legacy uuid URLs so they get an existence check keyed by id", () => {
    // The page 308-redirects these only when the id resolves; otherwise it
    // calls notFound(), which is a soft 200. So they still need checking.
    const parsed = parseEntityDetail("/en/products/3f2504e0-4f89-11d3-9a0c-0305e82c3301");
    expect(parsed?.isId).toBe(true);
    expect(parsed?.slug).toBe("3f2504e0-4f89-11d3-9a0c-0305e82c3301");
  });

  it("returns null for anything that is not a three-part storefront URL", () => {
    for (const path of ["/en/products", "/en/products/a/b", "/en/dashboard/orders"]) {
      expect(parseEntityDetail(path), path).toBeNull();
    }
  });

  it("returns null for inherited Object members used as a segment", () => {
    for (const path of ["/en/valueOf/x", "/en/constructor/x", "/en/hasOwnProperty/x"]) {
      expect(parseEntityDetail(path), path).toBeNull();
    }
  });
});

describe("derivation from routing.pathnames", () => {
  it("covers every localized alias of all three entity kinds", () => {
    expect(ENTITY_SEGMENTS).toEqual({
      products: "product",
      proizvodi: "product",
      produkte: "product",
      productos: "product",
      brands: "brand",
      brendovi: "brand",
      marken: "brand",
      marcas: "brand",
      categories: "category",
      kategorije: "category",
      kategorien: "category",
      categorias: "category",
    });
  });

  it("resolves the localized listing segment per locale", () => {
    expect(localizedSegment("product", "sr")).toBe("proizvodi");
    expect(localizedSegment("brand", "de")).toBe("marken");
    expect(localizedSegment("category", "es")).toBe("categorias");
    // Junk locale falls back to the default rather than emitting a dead link.
    expect(localizedSegment("product", "xx")).toBe("products");
  });
});
