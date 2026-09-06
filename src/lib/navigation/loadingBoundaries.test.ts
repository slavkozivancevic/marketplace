import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * A `loading.tsx` is NOT scoped to its own `page.tsx`. Next.js turns it into a
 * Suspense boundary around the whole segment, so its fallback is what the
 * router shows for every route nested underneath it too.
 *
 * That is how `/sr/admin/products/<id>/edit` came to flash the products LIST
 * skeleton - breadcrumbs, "Products", the Bulk/Add buttons and a table - for
 * the whole server round-trip, even though the edit route has a perfectly good
 * skeleton of its own. The child boundary never got a chance: the parent's
 * fallback wins while the child subtree is still being fetched.
 *
 * The fix is a `(list)` route group: put the list `page.tsx` and its
 * `loading.tsx` in one, and the fallback covers the list alone while sibling
 * routes keep their own. `(public)/products/(list)` and `(public)/brands/(list)`
 * were moved for exactly this reason; seven admin and dashboard segments later
 * grew flat `loading.tsx` files and reintroduced the leak.
 *
 * This guard fails the build instead of letting it happen a third time.
 */
describe("loading.tsx never leaks into nested routes", () => {
  const appRoot = join(process.cwd(), "src", "app");

  /** Directories holding a `loading.tsx`. */
  function collectLoadingDirs(dir: string): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) found.push(...collectLoadingDirs(child));
      else if (entry.name === "loading.tsx") found.push(dir);
    }
    return found;
  }

  /**
   * Every `page.tsx` strictly BELOW `dir` - a page sitting next to the
   * `loading.tsx` is the one it is meant to cover.
   *
   * `route.ts` handlers are deliberately not collected: they return a file or
   * JSON rather than navigating, so no fallback is ever rendered for them
   * (`dashboard/orders/[id]/invoice` is the only one that would match).
   */
  function collectNestedPages(dir: string, depth = 0): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = join(dir, entry.name);
      if (entry.isDirectory()) found.push(...collectNestedPages(child, depth + 1));
      else if (entry.name === "page.tsx" && depth > 0) found.push(child);
    }
    return found;
  }

  it("has no loading.tsx covering a route other than its own page", () => {
    const leaks = collectLoadingDirs(appRoot)
      .map((dir) => ({
        loading: relative(appRoot, join(dir, "loading.tsx")).split(sep).join("/"),
        covers: collectNestedPages(dir).map((p) => relative(appRoot, p).split(sep).join("/")),
      }))
      .filter((entry) => entry.covers.length > 0);

    expect(
      leaks,
      leaks
        .map(
          (l) =>
            `${l.loading} is the fallback for ${l.covers.length} nested route(s): ` +
            `${l.covers.join(", ")}. Move it and its page.tsx into a route group ` +
            `- (list) for an index page, (detail) for a record page - so the ` +
            `fallback stops covering the routes underneath.`,
        )
        .join("\n"),
    ).toEqual([]);
  });
});
