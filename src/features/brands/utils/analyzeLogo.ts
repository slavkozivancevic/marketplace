import "server-only";
import sharp from "sharp";
import type { LogoBackdrop } from "@/features/brands/components/BrandLogo";

/** Cap the download so a hostile/huge URL can't stall a brand save. */
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const FETCH_TIMEOUT_MS = 5_000;
/** Below this fraction of transparent pixels we treat the logo as opaque
 *  (it carries its own background) -> NEUTRAL. */
const TRANSPARENCY_THRESHOLD = 0.05;
/** Relative luminance (0-1) above which the visible ink is "light". */
const LIGHT_LUMINANCE = 0.55;

async function downloadImage(url: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type && !type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null;
    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Inspects a brand logo and decides which backdrop it needs, from the logo's
 * own pixels rather than the active theme:
 *
 * - mostly opaque (own background)       -> NEUTRAL
 * - transparent with mostly light ink    -> DARK  (needs a dark tile)
 * - transparent with mostly dark ink     -> LIGHT (needs a light tile)
 *
 * Returns `AUTO` on any failure so a flaky URL never blocks the save; the
 * caller persists whatever comes back.
 */
export async function analyzeLogoBackdrop(url: string): Promise<LogoBackdrop> {
  try {
    const buf = await downloadImage(url);
    if (!buf) return "AUTO";

    // Downscale before reading raw pixels: a thumbnail is plenty for stats and
    // keeps memory/CPU bounded regardless of the source resolution.
    const { data, info } = await sharp(buf)
      .resize(64, 64, { fit: "inside", withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels; // 4 after ensureAlpha
    const pixelCount = info.width * info.height;
    if (pixelCount === 0) return "AUTO";

    let transparent = 0;
    let lumWeightedSum = 0;
    let alphaSum = 0;

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3] / 255;

      if (a < 0.85) transparent += 1;

      // Weight luminance by opacity so faint edges don't skew the verdict.
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      lumWeightedSum += lum * a;
      alphaSum += a;
    }

    const transparentFraction = transparent / pixelCount;
    if (transparentFraction < TRANSPARENCY_THRESHOLD) return "NEUTRAL";

    const avgLuminance = alphaSum > 0 ? lumWeightedSum / alphaSum : 0.5;
    return avgLuminance >= LIGHT_LUMINANCE ? "DARK" : "LIGHT";
  } catch {
    return "AUTO";
  }
}
