// Downloads product images from the Pexels API (curated commercial-use
// stock photography) into per-product subfolders, resized/compressed with
// sharp.
//
// Run: PEXELS_API_KEY=... npx tsx scripts/staging/images/fetch.ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { plan } from "./plan";

const DEST = process.env.DEST ?? "C:\\Users\\slavk\\OneDrive\\Desktop\\marketverse";
const UA = "MarketVerse-catalog-sourcing/1.0 (staging content curation; contact: slavko.zivancevic@protonmail.com)";
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
if (!PEXELS_API_KEY) throw new Error("PEXELS_API_KEY env var is required");
const MAX_DIM = 1600;
const JPEG_QUALITY = 82;

type PexelsResult = {
  url: string; // image src to download
  width: number;
  height: number;
  license: string; // Pexels License (always "Pexels License")
  license_url: string;
  creator: string;
  creator_url: string;
  foreign_landing_url: string; // pexels.com page
  title: string; // alt text
  source: "pexels";
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function searchPexels(query: string): Promise<PexelsResult[]> {
  const url = `https://api.pexels.com/v1/search?${new URLSearchParams({
    query,
    per_page: "5",
  })}`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY! } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    photos?: {
      width: number;
      height: number;
      url: string;
      photographer: string;
      photographer_url: string;
      alt: string;
      src: { large2x: string };
    }[];
  };
  return (json.photos ?? []).map((p) => ({
    url: p.src.large2x,
    width: p.width,
    height: p.height,
    license: "Pexels License",
    license_url: "https://www.pexels.com/license/",
    creator: p.photographer,
    creator_url: p.photographer_url,
    foreign_landing_url: p.url,
    title: p.alt || query,
    source: "pexels" as const,
  }));
}

function pickBest(results: PexelsResult[]): PexelsResult | null {
  return results[0] ?? null;
}

async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type && !type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.byteLength > 0 ? buf : null;
  } catch {
    return null;
  }
}

type ShotResult = {
  name: string;
  ok: boolean;
  file?: string;
  bytes?: number;
  source?: { title: string; creator: string | null; url: string; license: string; landing: string };
  error?: string;
};

async function main() {
  const summary: { slug: string; title: string; note?: string; shots: ShotResult[] }[] = [];

  for (const product of plan) {
    const dir = path.join(DEST, product.slug);
    await mkdir(dir, { recursive: true });
    const shotResults: ShotResult[] = [];

    for (const shot of product.shots) {
      process.stdout.write(`${product.slug}/${shot.name} ... `);
      const results = await searchPexels(shot.query);
      const best = pickBest(results);
      if (!best) {
        console.log("NO RESULTS");
        shotResults.push({ name: shot.name, ok: false, error: "no search results" });
        await sleep(300);
        continue;
      }
      const raw = await downloadImage(best.url);
      if (!raw) {
        console.log("DOWNLOAD FAILED");
        shotResults.push({ name: shot.name, ok: false, error: `download failed (${best.url})` });
        await sleep(300);
        continue;
      }
      try {
        const sharp = (await import("sharp")).default;
        const outBuf = await sharp(raw)
          .rotate()
          .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
          .toBuffer();
        const file = `${shot.name}.jpg`;
        await writeFile(path.join(dir, file), outBuf);
        console.log(`ok (${(outBuf.byteLength / 1024).toFixed(0)} KB, ${best.license}, ${best.source})`);
        shotResults.push({
          name: shot.name,
          ok: true,
          file,
          bytes: outBuf.byteLength,
          source: {
            title: best.title,
            creator: best.creator,
            url: best.url,
            license: best.license,
            landing: best.foreign_landing_url,
          },
        });
      } catch (e) {
        console.log("PROCESS FAILED");
        shotResults.push({ name: shot.name, ok: false, error: `sharp processing failed: ${(e as Error).message}` });
      }
      await sleep(350);
    }

    // Per-product README with variant assignment + attribution.
    const lines: string[] = [];
    lines.push(`${product.title}`);
    lines.push("=".repeat(product.title.length));
    lines.push("");
    if (product.note) {
      lines.push(`NAPOMENA: ${product.note}`);
      lines.push("");
    }
    lines.push("Fajlovi i izvor:");
    for (const s of shotResults) {
      if (s.ok && s.source) {
        lines.push(`- ${s.file}  <-  "${s.source.title}" by ${s.source.creator ?? "unknown"} (${s.source.license}) ${s.source.landing}`);
      } else {
        lines.push(`- [NEDOSTAJE] ${s.name} — ${s.error} — pretraži ručno: "${product.shots.find((x) => x.name === s.name)?.query}"`);
      }
    }
    await writeFile(path.join(dir, "README.txt"), lines.join("\n"), "utf8");

    summary.push({ slug: product.slug, title: product.title, note: product.note, shots: shotResults });
  }

  const okCount = summary.reduce((s, p) => s + p.shots.filter((x) => x.ok).length, 0);
  const failCount = summary.reduce((s, p) => s + p.shots.filter((x) => !x.ok).length, 0);
  const totalBytes = summary.reduce((s, p) => s + p.shots.reduce((s2, x) => s2 + (x.bytes ?? 0), 0), 0);

  await writeFile(
    path.join(DEST, "_manifest.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );

  console.log(`\n✅ Done. ${okCount} images saved, ${failCount} failed/missing. Total ${(totalBytes / 1024 / 1024).toFixed(1)} MB.`);
  if (failCount > 0) {
    console.log("Missing shots:");
    for (const p of summary) {
      for (const s of p.shots) {
        if (!s.ok) console.log(` - ${p.slug}/${s.name}: ${s.error}`);
      }
    }
  }
}

main().catch((e) => {
  console.error("❌ fetch failed:", e);
  process.exit(1);
});
