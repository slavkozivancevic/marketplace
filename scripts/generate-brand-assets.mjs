/**
 * Generates the raster brand assets from the MarketVerse SVG mark:
 *
 *   - src/app/favicon.ico   16+32+48 PNG frames, dark tile + white mark
 *   - src/app/apple-icon.png 180x180 full-bleed dark tile (iOS rounds corners)
 *   - public/email-logo.png  96x96 rounded dark tile, referenced by the
 *                            marketplace-notifications email header as
 *                            {appUrl}/email-logo.png
 *   - public/email-header-bg.png 1200x240 cosmos star-field strip used as the
 *                            email header background ({appUrl}/email-header-bg.png)
 *   - public/brand/stripe-icon.png 512x512 rounded dark tile - upload as the
 *                            "Icon" in Stripe Dashboard branding settings
 *   - public/brand/stripe-icon-dark.png 512x512 mark alone on transparent -
 *                            icon variant for dark surfaces (tile would vanish
 *                            into the #040511 brand-color backdrop)
 *   - public/brand/stripe-logo.png horizontal lockup (mark + ink wordmark) on
 *                            transparent - Stripe "Logo" for light surfaces
 *   - public/brand/stripe-logo-dark.png horizontal lockup (mark + white
 *                            wordmark, violet "Verse") on transparent - Stripe
 *                            "Logo" for the dark #040511 checkout header
 *
 * Wordmark colors follow the approved lockups ("MarketVerse - logo koncepti"
 * artifact): on dark #f2eee7 + violet #9076f3 "Verse", on light #0a0b1e +
 * #5a30b9 "Verse" - the same split the email header uses.
 *
 * The mark paths are the single source of truth shared (manually) with
 * src/components/layout/brand-mark.tsx and src/app/icon.svg - edit those
 * together, then re-run:  node scripts/generate-brand-assets.mjs
 */
import sharp from "sharp";
import opentype from "opentype.js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Wordmark glyphs come from Geist Bold (the app's --font-sans at font-bold),
// converted to outlines with opentype.js so the render never depends on which
// fonts the OS running this script happens to have installed.
const geistBoldFile = await readFile(path.join(root, "public/fonts/Geist-Bold.ttf"));
const geistBold = opentype.parse(
  geistBoldFile.buffer.slice(geistBoldFile.byteOffset, geistBoldFile.byteOffset + geistBoldFile.byteLength),
);

/** The mark for dark backdrops (white outline bag, white/gray comet+stars). */
const MARK_DARK = `
  <path d="M3 7 C20 8 34 12 44.2 17.8 L43.6 23.3 C32 18.5 17 12 3 7 Z" fill="url(#tw)"/>
  <circle cx="47" cy="20.5" r="4.2" fill="#f2eee7"/>
  <path d="M20 30 L44 30 L47.3 46.8 Q48 50 44.5 50 L19.5 50 Q16 50 16.7 46.8 Z" fill="#0a0b1e" stroke="#f2eee7" stroke-width="1.5"/>
  <path d="M27 30 v-2.8 a5 5 0 0 1 10 0 V30" fill="none" stroke="#f2eee7" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M10 11.2 Q10.7 13.3 12.8 14 Q10.7 14.7 10 16.8 Q9.3 14.7 7.2 14 Q9.3 13.3 10 11.2 Z" fill="#f2eee7"/>
  <path d="M55 10 Q55.5 11.5 57 12 Q55.5 12.5 55 14 Q54.5 12.5 53 12 Q54.5 11.5 55 10 Z" fill="#c9c7d0" opacity=".9"/>
  <path d="M7 35.6 Q7.6 37.4 9.4 38 Q7.6 38.6 7 40.4 Q6.4 38.6 4.6 38 Q6.4 37.4 7 35.6 Z" fill="#f2eee7" opacity=".85"/>
  <path d="M57 40.2 Q57.45 41.55 58.8 42 Q57.45 42.45 57 43.8 Q56.55 42.45 55.2 42 Q56.55 41.55 57 40.2 Z" fill="#a5a3b0" opacity=".85"/>
  <path d="M12 53.4 Q12.4 54.6 13.6 55 Q12.4 55.4 12 56.6 Q11.6 55.4 10.4 55 Q11.6 54.6 12 53.4 Z" fill="#c9c7d0" opacity=".8"/>
  <circle cx="52" cy="31" r="0.9" fill="#f2eee7" opacity=".55"/>
  <circle cx="34" cy="57.5" r="1" fill="#a5a3b0" opacity=".6"/>`;

/**
 * The mark for light backdrops (artifact "lg-light"): everything inverted -
 * dark comet + stars, solid #0a0b1e bag silhouette, no white outline.
 */
const MARK_LIGHT = `
  <path d="M3 7 C20 8 34 12 44.2 17.8 L43.6 23.3 C32 18.5 17 12 3 7 Z" fill="url(#td)"/>
  <circle cx="47" cy="20.5" r="4.2" fill="#0a0b1e"/>
  <path d="M20 30 L44 30 L47.3 46.8 Q48 50 44.5 50 L19.5 50 Q16 50 16.7 46.8 Z" fill="#0a0b1e"/>
  <path d="M27 30 v-2.8 a5 5 0 0 1 10 0 V30" fill="none" stroke="#0a0b1e" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M10 11.2 Q10.7 13.3 12.8 14 Q10.7 14.7 10 16.8 Q9.3 14.7 7.2 14 Q9.3 13.3 10 11.2 Z" fill="#0a0b1e"/>
  <path d="M55 10 Q55.5 11.5 57 12 Q55.5 12.5 55 14 Q54.5 12.5 53 12 Q54.5 11.5 55 10 Z" fill="#4a4956" opacity=".9"/>
  <path d="M7 35.6 Q7.6 37.4 9.4 38 Q7.6 38.6 7 40.4 Q6.4 38.6 4.6 38 Q6.4 37.4 7 35.6 Z" fill="#0a0b1e" opacity=".9"/>
  <path d="M57 40.2 Q57.45 41.55 58.8 42 Q57.45 42.45 57 43.8 Q56.55 42.45 55.2 42 Q56.55 41.55 57 40.2 Z" fill="#6b6a78" opacity=".9"/>
  <path d="M12 53.4 Q12.4 54.6 13.6 55 Q12.4 55.4 12 56.6 Q11.6 55.4 10.4 55 Q11.6 54.6 12 53.4 Z" fill="#4a4956" opacity=".85"/>
  <circle cx="52" cy="31" r="0.9" fill="#0a0b1e" opacity=".6"/>
  <circle cx="34" cy="57.5" r="1" fill="#6b6a78" opacity=".65"/>`;

const TAIL_GRADIENT = `
  <linearGradient id="tw" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#f2eee7" stop-opacity="0"/>
    <stop offset=".55" stop-color="#c9c7d0" stop-opacity=".5"/>
    <stop offset="1" stop-color="#f2eee7"/>
  </linearGradient>
  <linearGradient id="td" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#0a0b1e" stop-opacity="0"/>
    <stop offset=".55" stop-color="#4a4956" stop-opacity=".5"/>
    <stop offset="1" stop-color="#0a0b1e"/>
  </linearGradient>`;

/**
 * Dark tile with the mark inset. `radius` is the corner radius in 64-viewBox
 * units (0 for full-bleed apple-icon - iOS applies its own mask).
 */
function tileSvg(radius) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${TAIL_GRADIENT}</defs>
  <rect width="64" height="64" rx="${radius}" fill="#0a0b1e"/>
  <g transform="translate(5.76,5.76) scale(0.82)">${MARK_DARK}</g>
</svg>`;
}

async function png(svg, size) {
  return sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size)
    .png()
    .toBuffer();
}

/** Pack PNG buffers into an .ico container (PNG-in-ICO, fine for browsers). */
function packIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);
  let offset = 6 + 16 * frames.length;
  const entries = [];
  for (const { size, buf } of frames) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size === 256 ? 0 : size, 0);
    e.writeUInt8(size === 256 ? 0 : size, 1);
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...frames.map((f) => f.buf)]);
}

/**
 * Wide cosmos strip for the email header: deep-space background, faint indigo
 * nebula glow, silver/indigo stars. Rendered at 2x (1200x240) for retina.
 */
function headerBgSvg() {
  const sparkle = (x, y, s, fill, o) =>
    `<path d="M${x} ${y - s} Q${x + s * 0.25} ${y - s * 0.25} ${x + s} ${y} Q${x + s * 0.25} ${y + s * 0.25} ${x} ${y + s} Q${x - s * 0.25} ${y + s * 0.25} ${x - s} ${y} Q${x - s * 0.25} ${y - s * 0.25} ${x} ${y - s} Z" fill="${fill}" opacity="${o}"/>`;
  const dot = (x, y, r, fill, o) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${o}"/>`;
  const SILVER = "#d3d8de";
  const INDIGO = "#807cc6";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120">
  <defs>
    <radialGradient id="neb" cx="0.75" cy="0.1" r="1">
      <stop offset="0" stop-color="#483e90" stop-opacity="0.32"/>
      <stop offset="0.6" stop-color="#191731" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#040511" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="600" height="120" fill="#040511"/>
  <rect width="600" height="120" fill="url(#neb)"/>
  ${sparkle(70, 30, 5, SILVER, 0.85)}
  ${sparkle(210, 82, 4, INDIGO, 0.8)}
  ${sparkle(340, 24, 3.5, SILVER, 0.7)}
  ${sparkle(455, 66, 5.5, SILVER, 0.8)}
  ${sparkle(545, 28, 4, INDIGO, 0.75)}
  ${dot(30, 78, 1.6, SILVER, 0.6)}${dot(120, 14, 1.2, SILVER, 0.5)}
  ${dot(158, 58, 1.8, INDIGO, 0.55)}${dot(255, 40, 1.2, SILVER, 0.65)}
  ${dot(300, 96, 1.5, SILVER, 0.45)}${dot(388, 74, 1.2, INDIGO, 0.6)}
  ${dot(420, 12, 1.4, SILVER, 0.5)}${dot(505, 92, 1.6, SILVER, 0.55)}
  ${dot(575, 70, 1.2, INDIGO, 0.5)}${dot(65, 104, 1.2, SILVER, 0.4)}
  ${dot(195, 20, 1, SILVER, 0.45)}${dot(360, 52, 1, SILVER, 0.5)}
</svg>`;
}

const rounded = tileSvg(14);
const fullBleed = tileSvg(0);

const icoFrames = [];
for (const size of [16, 32, 48]) {
  icoFrames.push({ size, buf: await png(rounded, size) });
}
await writeFile(path.join(root, "src/app/favicon.ico"), packIco(icoFrames));
console.log("wrote src/app/favicon.ico (16/32/48)");

await writeFile(path.join(root, "src/app/apple-icon.png"), await png(fullBleed, 180));
console.log("wrote src/app/apple-icon.png (180)");

await writeFile(path.join(root, "public/email-logo.png"), await png(rounded, 96));
console.log("wrote public/email-logo.png (96)");

const headerBuf = await sharp(Buffer.from(headerBgSvg()), { density: 300 })
  .resize(1200, 240)
  .png()
  .toBuffer();
await writeFile(path.join(root, "public/email-header-bg.png"), headerBuf);
console.log("wrote public/email-header-bg.png (1200x240)");

// Stripe branding uploads (Dashboard -> Settings -> Branding).
await mkdir(path.join(root, "public/brand"), { recursive: true });
await writeFile(path.join(root, "public/brand/stripe-icon.png"), await png(rounded, 512));
console.log("wrote public/brand/stripe-icon.png (512)");

// Icon variant for dark surfaces: the mark alone on transparent (the rounded
// tile would vanish into the #040511 brand-color backdrop).
const iconDarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>${TAIL_GRADIENT}</defs>
  <g transform="translate(1.92,1.92) scale(0.94)">${MARK_DARK}</g>
</svg>`;
const iconDarkBuf = await sharp(Buffer.from(iconDarkSvg), { density: 300 })
  .resize(512, 512)
  .png()
  .toBuffer();
await writeFile(path.join(root, "public/brand/stripe-icon-dark.png"), iconDarkBuf);
console.log("wrote public/brand/stripe-icon-dark.png (512)");

// Horizontal lockups, mirroring the approved artifact treatments: the mark
// sits directly on the surface (no tile), wordmark is two-tone Geist Bold
// rendered as outlines (40px, -0.5px tracking, baseline y=62).
const WORD_SIZE = 40;
const WORD_TRACKING = -0.5 / WORD_SIZE; // opentype.js letterSpacing is in em
const wordOptions = { kerning: true, letterSpacing: WORD_TRACKING };

// Serialize path commands ourselves - opentype.js 2.0.0's toPathData() emits
// NaN coordinates for the last glyph, which breaks the SVG render.
function pathData(p) {
  const r = (n) => Math.round(n * 100) / 100;
  return p.commands
    .map((c) => {
      if (c.type === "M") return `M${r(c.x)} ${r(c.y)}`;
      if (c.type === "L") return `L${r(c.x)} ${r(c.y)}`;
      if (c.type === "Q") return `Q${r(c.x1)} ${r(c.y1)} ${r(c.x)} ${r(c.y)}`;
      if (c.type === "C") return `C${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)} ${r(c.x)} ${r(c.y)}`;
      return "Z";
    })
    .join("");
}

function wordPath(text, x, fill) {
  const p = geistBold.getPath(text, x, 62, WORD_SIZE, wordOptions);
  return `<path d="${pathData(p)}" fill="${fill}"/>`;
}

function lockupSvg({ mark, markWord, verseWord }) {
  const marketWidth = geistBold.getAdvanceWidth("Market", WORD_SIZE, wordOptions);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 96">
  <defs>${TAIL_GRADIENT}</defs>
  <g transform="translate(11.2,15.2) scale(1.025)">${mark}</g>
  ${wordPath("Market", 100, markWord)}
  ${wordPath("Verse", 100 + marketWidth, verseWord)}
</svg>`;
}

async function lockupPng(svg, file) {
  const buf = await sharp(Buffer.from(svg), { density: 300 })
    .resize(1440, 384)
    .png()
    .toBuffer();
  await writeFile(path.join(root, file), buf);
  console.log(`wrote ${file} (1440x384)`);
}

// Light surfaces: inverted mark (dark silhouette + ink stars), ink wordmark,
// deep-violet "Verse" - the artifact "SVETLA PODLOGA" lockup.
await lockupPng(
  lockupSvg({ mark: MARK_LIGHT, markWord: "#0a0b1e", verseWord: "#5a30b9" }),
  "public/brand/stripe-logo.png",
);
// Dark surfaces (#040511 checkout header): white-outline mark, white wordmark,
// light-violet "Verse" - the artifact "TAMNA PODLOGA" lockup, same split as
// the email header.
await lockupPng(
  lockupSvg({ mark: MARK_DARK, markWord: "#f2eee7", verseWord: "#9076f3" }),
  "public/brand/stripe-logo-dark.png",
);
