import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { routing } from "@/i18n/routing";
import { isUnknownLocalePath } from "./appRoutes";

describe("isUnknownLocalePath", () => {
  it("reports unknown locale-prefixed URLs, which the catch-all answered 200", () => {
    for (const path of [
      "/en/nepostojeca-stranica",
      "/en/about",
      "/en/dashboard/typo",
      "/sr/admin/nema-ovoga",
      "/de/dashboard/orders/123/nope",
    ]) {
      expect(isUnknownLocalePath(path), path).toBe(true);
    }
  });

  it("accepts every route in the table, in every locale", () => {
    for (const path of [
      "/en",
      "/en/",
      "/sr/proizvodi",
      "/sr/proizvodi/neki-slug",
      "/de/produkte/ein-slug",
      "/es/marcas/una-marca",
      "/en/categories/some-category",
      "/sr/lista-zelja",
      "/de/kasse/erfolgreich",
      "/es/pagar/cancelado",
      "/en/dashboard",
      "/en/dashboard/my-products/abc/edit",
      "/en/dashboard/orders/abc",
      "/en/dashboard/organization/orders/abc",
      "/en/admin/products/abc/history",
      "/en/admin/coupons/abc/edit",
      "/en/invite/some-token",
    ]) {
      expect(isUnknownLocalePath(path), path).toBe(false);
    }
  });

  it("accepts the invoice route handler, which is not a page", () => {
    // A `route.ts` under the locale tree. It is in routing.pathnames purely so
    // this check does not 404 it - the reason that entry exists.
    expect(isUnknownLocalePath("/en/dashboard/orders/abc/invoice")).toBe(false);
  });

  it("accepts Clerk's optional catch-all with zero or more segments", () => {
    for (const path of [
      "/en/sign-in",
      "/en/sign-in/factor-one",
      "/en/sign-up/verify-email-address",
    ]) {
      expect(isUnknownLocalePath(path), path).toBe(false);
    }
  });

  it("leaves cross-locale segments to next-intl's redirect", () => {
    // `/en/marken` is the German alias under the English prefix. next-intl
    // redirects it to /de/marken; 404ing here would break a working link.
    for (const path of ["/en/marken", "/sr/products/foo", "/de/productos"]) {
      expect(isUnknownLocalePath(path), path).toBe(false);
    }
  });

  it("ignores everything without a real locale prefix", () => {
    for (const path of ["/", "/products", "/api/products", "/sitemap.xml", "/xx/whatever"]) {
      expect(isUnknownLocalePath(path), path).toBe(false);
    }
  });
});

/**
 * The guard that makes it safe for middleware to decide 404s from the route
 * table: a new route that is not registered in `routing.pathnames` fails here
 * instead of being 404'd in production.
 */
describe("routing.pathnames covers the app directory", () => {
  const localeRoot = join(process.cwd(), "src", "app", "(i18n)", "[locale]");

  function collectRoutes(dir: string, segments: string[] = []): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        // Route groups - `(public)`, `(list)` - are organisational only and
        // contribute no URL segment.
        const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
        found.push(
          ...collectRoutes(join(dir, entry.name), isGroup ? segments : [...segments, entry.name]),
        );
      } else if (entry.name === "page.tsx" || entry.name === "route.ts") {
        found.push(`/${segments.join("/")}`.replace(/\/$/, "") || "/");
      }
    }
    return found;
  }

  it("has an entry for every page.tsx and route.ts under [locale]", () => {
    const keys = new Set(Object.keys(routing.pathnames));
    const missing = collectRoutes(localeRoot)
      // The catch-all is the fallback these 404s replace, not a real route.
      .filter((route) => !route.startsWith("/[...rest]"))
      .filter((route) => !keys.has(route));

    expect(missing, `Add these to routing.pathnames: ${missing.join(", ")}`).toEqual([]);
  });
});
