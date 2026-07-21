// Offline validation of the curation dataset (no DB needed).
import { electronics } from "./content/products-electronics";
import { fashion } from "./content/products-fashion";
import { homeSports } from "./content/products-home-sports";
import { misc } from "./content/products-misc";
import { brands } from "./content/brands";
import { categories } from "./content/categories";
import type { Locale, ProductContent } from "./content/types";

const LOCALES: Locale[] = ["en", "sr", "de", "es"];
const all: Record<string, ProductContent> = { ...electronics, ...fashion, ...homeSports, ...misc };

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replaceAll("đ", "dj")
    .replaceAll("ß", "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

let errors = 0;
const err = (m: string) => { errors++; console.error(`✗ ${m}`); };

// Expected keys from the seed catalog (en slugs).
const EXPECTED = 92;
const keys = Object.keys(all);
if (keys.length !== EXPECTED) err(`expected ${EXPECTED} products, got ${keys.length}`);

const brandSlugs = new Set(Object.keys(brands));
const validPalette = new Set(["black", "white", "red", "blue", "green", "yellow", "gray"]);
const volumeOpts = new Set(["30ml", "50ml", "100ml", "200ml"]);
const platformOpts = new Set(["pc", "playstation", "xbox", "switch"]);

for (const locale of LOCALES) {
  const seen = new Map<string, string>();
  for (const [k, p] of Object.entries(all)) {
    for (const l of LOCALES) {
      const t = p.t[l];
      if (!t || !t.title.trim() || !t.short.trim() || !t.desc.trim()) err(`${k}: missing/empty ${l} content`);
      if (t && t.short.length > 220) err(`${k}: ${l} short too long (${t.short.length})`);
    }
    const slug = locale === "en" ? k : slugify(p.t[locale].title);
    if (!slug) err(`${k}: empty ${locale} slug`);
    if (seen.has(slug)) err(`slug collision [${locale}] "${slug}": ${seen.get(slug)} vs ${k}`);
    seen.set(slug, k);

    if (p.brand && p.brand !== "keep" && !brandSlugs.has(p.brand)) err(`${k}: unknown brand ${p.brand}`);
    const v = p.variants;
    if (v.mode === "colors") for (const c of v.palette) if (!validPalette.has(c)) err(`${k}: bad palette color ${c}`);
    if (v.mode === "options") {
      const valid = v.attrKey === "volume" ? volumeOpts : v.attrKey === "platform" ? platformOpts : validPalette;
      for (const o of v.options) if (!valid.has(o.value)) err(`${k}: bad ${v.attrKey} option ${o.value}`);
      if (!v.options.some((o) => o.priceFactor === 1)) err(`${k}: options need a priceFactor 1 baseline`);
    }
  }
}

// Categories: 48 expected, slug uniqueness per locale, full locales.
const catKeys = Object.keys(categories);
if (catKeys.length !== 48) err(`expected 48 categories, got ${catKeys.length}`);
for (const locale of LOCALES) {
  const seen = new Map<string, string>();
  for (const [k, c] of Object.entries(categories)) {
    if (!c.names[locale]?.trim() || !c.slugs[locale]?.trim() || !c.desc[locale]?.trim()) err(`category ${k}: missing ${locale}`);
    const s = c.slugs[locale];
    if (seen.has(s)) err(`category slug collision [${locale}] "${s}": ${seen.get(s)} vs ${k}`);
    seen.set(s, k);
    if (slugify(c.slugs[locale]) !== c.slugs[locale]) err(`category ${k}: ${locale} slug not normalized: ${s}`);
  }
  if (categories[Object.keys(categories)[0]]) void 0;
}
for (const [k, c] of Object.entries(categories)) {
  if (c.slugs.en !== k) err(`category ${k}: en slug must equal key (got ${c.slugs.en})`);
}

// Brands: 16 expected, 4 locale descriptions each.
if (Object.keys(brands).length !== 16) err(`expected 16 brands, got ${Object.keys(brands).length}`);
for (const [k, b] of Object.entries(brands)) {
  for (const l of LOCALES) if (!b.desc[l]?.trim()) err(`brand ${k}: missing ${l} description`);
  if (!b.logoFiles.length) err(`brand ${k}: no logo candidates`);
  if (slugify(b.slug) !== b.slug) err(`brand ${k}: slug not normalized`);
}

if (errors === 0) {
  console.log(`✓ dataset OK: ${keys.length} products, ${catKeys.length} categories, ${Object.keys(brands).length} brands`);
} else {
  console.error(`\n${errors} error(s)`);
  process.exit(1);
}
