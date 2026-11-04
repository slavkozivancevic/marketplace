import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Guards patches/next+16.2.6.patch (applied by patch-package on postinstall).
 *
 * Next 16.2.6 answers a dynamic navigation with `S: isStaticGeneration` -
 * false - while every other payload sends `|| cacheComponents`. A route first
 * reached WITHOUT a prefetch (the phone sidebar lives in a sheet, so its links
 * are never prefetched) is then remembered as not supporting per-segment
 * prefetch; its next prefetch is a loading-boundary request, and on OpenNext
 * the navigation that follows it never commits - the progress bar runs, the
 * page stays. That was nav_stuck admin <-> dashboard.
 *
 * Upgrading Next without carrying the patch over compiles and passes every
 * other test. This one fails instead.
 */

const NEXT = join(__dirname, "..", "..", "..", "node_modules", "next", "dist");
const runtimes = [
  "app-page.runtime.prod.js",
  "app-page-turbo.runtime.prod.js",
  "app-page-experimental.runtime.prod.js",
  "app-page-turbo-experimental.runtime.prod.js",
];

describe("Next segment-prefetch patch", () => {
  it.each(runtimes)("%s keeps S true for dynamic navigations under cacheComponents", (file) => {
    const src = readFileSync(join(NEXT, "compiled", "next-server", file), "utf8");
    expect(src).not.toMatch(/S:[\w$]+\.isStaticGeneration,h:/);
  });

  it("the uncompiled app-render matches", () => {
    for (const dir of ["server", join("esm", "server")]) {
      const src = readFileSync(join(NEXT, dir, "app-render", "app-render.js"), "utf8");
      expect(src).not.toMatch(/S: workStore\.isStaticGeneration,\r?\n/);
    }
  });
});
