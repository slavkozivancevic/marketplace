import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, it, expect } from "vitest";

const SRC = join(__dirname, "..", "..");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "generated" ? [] : tsxFiles(p);
    return p.endsWith(".tsx") ? [p] : [];
  });
}

const sources = tsxFiles(SRC).map((file) => ({
  rel: relative(SRC, file).split(sep).join("/"),
  text: readFileSync(file, "utf8").replace(/\r\n/g, "\n"),
}));

/** The opening tag of every `role="row"` element, from the attribute to its `>`. */
function rowTags(text: string): string[] {
  const tags: string[] = [];
  let at = text.indexOf('role="row"');
  while (at !== -1) {
    const rest = text.slice(at);
    const end = rest.search(/\n\s*>\s*\n|\/>|">/);
    tags.push(end === -1 ? rest : rest.slice(0, end));
    at = text.indexOf('role="row"', at + 1);
  }
  return tags;
}

describe("press feedback", () => {
  it("a table row wrapped in a <Link> stays lit while its navigation is pending", () => {
    const offenders = sources
      .filter(({ text }) => text.includes('role="row"') && /<Link[\s\S]*?className="contents"/.test(text))
      .filter(({ text }) => !text.includes("<LinkPendingMark"))
      .map(({ rel }) => rel);

    expect(
      offenders,
      'Put <LinkPendingMark /> from "@/components/ui/pressable" inside the row, so the row you clicked stays tinted until the next page arrives',
    ).toEqual([]);
  });

  it("every clickable row has a pressed state", () => {
    const offenders = sources.flatMap(({ rel, text }) =>
      rowTags(text)
        .filter((tag) => /cursor-pointer|onClick=/.test(tag))
        .filter((tag) => !/pressSurface|active:/.test(tag))
        .map(() => rel),
    );

    expect(
      offenders,
      'Give a clickable row `pressSurface` from "@/components/ui/pressable" - on a touch screen the browser draws no tap highlight, so :active is the only sign a tap landed',
    ).toEqual([]);
  });

  it("every hand-styled button and link has a pressed state", () => {
    const offenders = sources.flatMap(({ rel, text }) =>
      [...text.matchAll(/<(button|Link|NextLink|a)\b/g)]
        .map((m) => ({ tag: openingTag(text, m.index), line: text.slice(0, m.index).split("\n").length }))
        // A hover style is what marks a hand-styled control; `<Button>` and
        // the shadcn primitives carry their own ladder.
        .filter(({ tag }) => /hover:/.test(tag))
        .filter(({ tag }) => !PRESSED.test(tag))
        .map(({ line }) => `${rel}:${line}`)
        .filter((at) => !STATE_CHANGING.some((ok) => at.startsWith(`${ok}:`))),
    );

    expect(
      offenders,
      'Give it a press class from "@/components/ui/pressable" (pressSurface, pressNavLink, pressCard, pressTile, pressText) or its own active: step - a hover style alone gives a touch screen nothing',
    ).toEqual([]);
  });
});

const PRESSED = /active:|pressSurface|pressNavLink|pressCard|pressTile|pressText/;

/**
 * Controls that answer a tap by changing what they show at once - a picked
 * variant pill, a calendar day, a gallery thumbnail, the wishlist heart, a
 * menu trigger opening its panel. The new state IS the feedback; a pressed
 * tint on top would flash a third colour between "off" and "on".
 */
const STATE_CHANGING = [
  "components/ui/date-picker.tsx",
  "components/ui/time-picker.tsx",
  "components/product/ProductImageCarousel.tsx",
  "components/layout/not-found-auth.tsx",
  "features/cart/components/AddToCart.tsx",
  "features/cart/components/CheckoutPage.tsx",
  "features/categories/components/CategoriesMegaMenu.tsx",
  "features/chat/components/QuoteBlock.tsx",
  "features/priceMarkets/components/CountryMultiSelect.tsx",
  "features/products/components/CountrySelect.tsx",
  "features/products/components/ProductCard.tsx",
  "features/products/components/QuickViewModal.tsx",
  "features/products/components/VariantsEditor.tsx",
  "features/wishlist/components/WishlistButton.tsx",
];

/** An opening JSX tag up to its own `>`, skipping any `>` inside {...} or quotes. */
function openingTag(text: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return text.slice(start, i + 1);
  }
  return text.slice(start);
}
