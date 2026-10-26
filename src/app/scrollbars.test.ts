import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it, expect } from "vitest";
import { SCROLLBAR_BOOTSTRAP_HTML, SCROLLBAR_CSS } from "@/lib/scrollbars/scrollbarStyle";
import { notFoundResponse } from "@/lib/seo/notFoundResponse";

/**
 * Guards the one scrollbar look (`src/lib/scrollbars/scrollbarStyle.ts`).
 * Every rule here is something that compiles, renders, and quietly brings the
 * Windows arrow scrollbar - or an empty lane - back on some surface.
 */

const SRC = join(__dirname, "..");
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const GLOBALS = stripComments(readFileSync(join(__dirname, "globals.css"), "utf8"));
const CSS = stripComments(SCROLLBAR_CSS);

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "generated" ? [] : files(p, ext);
    return ext.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : [];
  });
}

const rel = (p: string) => relative(SRC, p).split(sep).join("/");
const sources = files(SRC, /\.tsx?$/).map((p) => ({ rel: rel(p), text: readFileSync(p, "utf8") }));

/** [start, end) of the `@supports not selector(::-webkit-scrollbar) { ... }` block. */
function firefoxBlock(css: string): [number, number] {
  const start = css.indexOf("@supports not selector(::-webkit-scrollbar)");
  if (start === -1) return [-1, -1];
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return [start, i + 1];
  }
  return [start, css.length];
}

describe("scrollbars", () => {
  it("no component sets scrollbar-width or scrollbar-color (Chromium would drop the styled scrollbar for the arrow one)", () => {
    const offenders = sources
      .filter(({ rel }) => rel !== "lib/scrollbars/scrollbarStyle.ts")
      .flatMap(({ rel, text }) =>
        [
          ...text.matchAll(
            // Tailwind arbitrary property, utility class, and the `style={{}}` spelling.
            /scrollbar-width:(?!none)[a-z]+|scrollbar-color|\bscrollbar-thin\b|scrollbarColor|scrollbarWidth:\s*["'`](?!none)/g,
          ),
        ].map((m) => `${rel}: ${m[0]}`),
      );

    expect(offenders, "The scrollbar look is global - see src/lib/scrollbars/scrollbarStyle.ts").toEqual([]);
  });

  it("nothing reserves a scrollbar-gutter (it shows as an empty strip whenever nothing scrolls - use ScrollArea)", () => {
    const offenders = sources.flatMap(({ rel, text }) =>
      [...text.matchAll(/\[scrollbar-gutter:|scrollbarGutter/g)].map((m) => `${rel}: ${m[0]}`),
    );
    if (/scrollbar-gutter\s*:/.test(GLOBALS + CSS)) offenders.push("scrollbar-gutter in CSS");

    expect(offenders).toEqual([]);
  });

  it("globals.css has no scrollbar rules - scrollbarStyle.ts is the one source", () => {
    expect(GLOBALS).not.toMatch(/::-webkit-scrollbar|scrollbar-(width|color)\s*:|--scrollbar-thumb\s*:/);
  });

  it("sets the standard properties only for browsers without ::-webkit-scrollbar", () => {
    const [start, end] = firefoxBlock(CSS);
    expect(start, "the Firefox @supports block is missing").toBeGreaterThan(-1);

    // The one deliberate exception: on overlay platforms ScrollArea's viewport
    // gets the system scrollbar back (`auto`, the platform default).
    const OVERLAY_HANDBACK = 'html[data-scrollbars="overlay"] [data-radix-scroll-area-viewport]';

    const outside = [...CSS.matchAll(/scrollbar-(width|color)\s*:\s*([^;]+);/g)]
      .filter((m) => m.index! < start || m.index! >= end)
      .filter((m) => {
        const selector = CSS.slice(CSS.lastIndexOf("}", m.index!) + 1, CSS.lastIndexOf("{", m.index!)).trim();
        return !(selector === OVERLAY_HANDBACK && m[0].trim() === "scrollbar-width: auto;");
      })
      .map((m) => m[0]);
    expect(outside).toEqual([]);
  });

  it("styles ::-webkit-scrollbar only on classic-scrollbar platforms, for nested scrollers AND the document's own", () => {
    const selectors = [...CSS.matchAll(/([^{};]+)\{/g)]
      .flatMap((m) => m[1].split(","))
      .map((s) => s.trim())
      .filter((s) => s.includes("::-webkit-scrollbar") && !s.startsWith("@supports"));

    expect(selectors.length).toBeGreaterThan(0);
    for (const s of selectors) {
      expect(s, "unscoped rule would replace the native overlay on macOS / mobile").toMatch(
        /^html\[data-scrollbars="classic"\]( |::)/,
      );
    }
    // Every nested-scroller rule has its root twin, or the page's own scrollbar (static 404) keeps its arrows.
    const nested = selectors.filter((s) => s.includes('"] ::')).map((s) => s.replace('"] ::', '"]::'));
    const root = new Set(selectors.filter((s) => s.includes('"]::')));
    for (const s of nested) expect(root, s).toContain(s);
  });

  it("every document the app serves includes the scrollbar bootstrap", () => {
    // `<html lang` opens a real document, in JSX and in a string template alike.
    const documents = sources.filter(({ text }) => /<html\s+lang=/.test(text));

    expect(documents.map((d) => d.rel).sort()).toEqual(
      expect.arrayContaining([
        "app/(fallback)/layout.tsx",
        "app/(i18n)/[locale]/layout.tsx",
        "app/global-error.tsx",
        "lib/seo/notFoundResponse.ts",
      ]),
    );
    for (const { rel, text } of documents) {
      expect(/<ScrollbarScript \/>|SCROLLBAR_BOOTSTRAP_HTML/.test(text), rel).toBe(true);
    }
  });

  it("the proxy's static 404 actually ships it", async () => {
    const html = await notFoundResponse("sr").text();
    expect(html).toContain(SCROLLBAR_BOOTSTRAP_HTML);
    // Inside <body>: the detection probe needs document.body.
    expect(html.indexOf(SCROLLBAR_BOOTSTRAP_HTML)).toBeGreaterThan(html.indexOf("<body>"));
  });
});
