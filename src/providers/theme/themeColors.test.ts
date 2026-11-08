import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { RESOLVED_THEMES, THEME_COLORS } from "./constants";
import { setThemeColorMeta } from "./themeColorMeta";

const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

/** First `--background` declared directly in the given selector's block. */
function backgroundOf(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  const value = block?.[1].match(/--background:\s*([^;]+);/)?.[1];
  if (!value) throw new Error(`no --background in ${selector}`);
  return value.trim();
}

/** oklch(L C h) -> #rrggbb, the CSS Color 4 conversion. */
function oklchToHex(value: string): string {
  const m = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!m) throw new Error(`not an oklch color: ${value}`);
  const [L, C, h] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  return (
    "#" +
    rgb
      .map((x) => {
        const c = Math.min(1, Math.max(0, x));
        const g = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
        return Math.round(g * 255).toString(16).padStart(2, "0");
      })
      .join("")
  );
}

const SELECTOR = { light: ":root", dark: ".dark", cosmos: ".cosmos" } as const;

describe("theme-color follows the app theme", () => {
  it.each(RESOLVED_THEMES)("%s matches its --background in globals.css", (theme) => {
    expect(THEME_COLORS[theme]).toBe(oklchToHex(backgroundOf(SELECTOR[theme])));
  });

  it("FoucScript can inline setThemeColorMeta: it runs from its source text alone", () => {
    const metas: Array<Record<string, unknown>> = [
      { content: "x", remove() {}, removeAttribute() {} },
    ];
    const fakeDocument = {
      querySelectorAll: () => metas,
      createElement: () => ({}),
      head: { appendChild() {} },
    };
    const run = new Function("document", "color", `(${setThemeColorMeta.toString()})(color);`);
    run(fakeDocument, "#040511");
    expect(metas[0].content).toBe("#040511");
  });
});

describe("installed-app manifest", () => {
  const m = manifest();

  it("never lists icon.svg - Android renders its light variant (dark bag)", () => {
    expect(m.icons?.some((i) => i.src.endsWith(".svg"))).toBe(false);
  });

  it("has a maskable icon at 512", () => {
    expect(m.icons).toContainEqual(
      expect.objectContaining({ purpose: "maskable", sizes: "512x512" }),
    );
  });
});
