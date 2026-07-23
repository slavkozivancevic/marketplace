// Reads decisions.json (numeric index, "REQUERY:<index>" resolved-from-second-
// pass, or "SKIP") + candidates.json + requery-candidates.json, downloads the
// chosen full-res image for every shot, processes with sharp, and writes it
// into DEST/<slug>/<shotname>.jpg with a per-product README (attribution +
// variant-assignment note).
//
// Run: npx tsx scripts/staging/images/finalize.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { plan as plan1 } from "./plan";
import { plan2 } from "./plan2";
import { plan3 } from "./plan3";
const plan = process.env.PLAN === "3" ? plan3 : process.env.PLAN === "2" ? plan2 : plan1;

const DEST = process.env.DEST ?? "C:\\Users\\slavk\\OneDrive\\Desktop\\marketverse";
const REVIEW_DIR = process.env.REVIEW_DIR ?? path.join(process.cwd(), ".image-review");
const MAX_DIM = 1600;
const JPEG_QUALITY = 82;

type Candidate = {
  index: number;
  url: string;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  photographer_url: string;
  landing: string;
};

async function fetchBuf(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function main() {
  const sharp = (await import("sharp")).default;
  const decisions = JSON.parse(await readFile(path.join(REVIEW_DIR, "decisions.json"), "utf8")) as Record<string, number | string>;
  const candidates = JSON.parse(await readFile(path.join(REVIEW_DIR, "candidates.json"), "utf8")) as Record<string, Candidate[]>;
  const requeryCandidates = JSON.parse(
    await readFile(path.join(REVIEW_DIR, "requery-candidates.json"), "utf8"),
  ) as Record<string, Candidate[]>;

  type ShotResult = {
    name: string;
    ok: boolean;
    skipped?: boolean;
    file?: string;
    bytes?: number;
    source?: { title: string; creator: string; url: string; landing: string };
    error?: string;
  };

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const product of plan) {
    const dir = path.join(DEST, product.slug);
    await mkdir(dir, { recursive: true });
    const shotResults: ShotResult[] = [];

    for (const shot of product.shots) {
      const key = `${product.slug}__${shot.name}`;
      const decision = decisions[key];

      if (decision === "SKIP") {
        shotResults.push({ name: shot.name, ok: false, skipped: true, error: "no acceptable candidate found - needs manual sourcing" });
        skipped++;
        continue;
      }

      let chosen: Candidate | undefined;
      if (typeof decision === "string" && decision.startsWith("REQUERY:")) {
        const idx = Number(decision.slice("REQUERY:".length));
        chosen = requeryCandidates[key]?.find((c) => c.index === idx);
      } else if (typeof decision === "number") {
        chosen = candidates[key]?.find((c) => c.index === decision);
      }

      if (!chosen) {
        console.log(`✗ ${key}: no candidate resolved for decision ${JSON.stringify(decision)}`);
        shotResults.push({ name: shot.name, ok: false, error: "decision could not be resolved" });
        failed++;
        continue;
      }

      const raw = await fetchBuf(chosen.url);
      if (!raw) {
        console.log(`✗ ${key}: download failed`);
        shotResults.push({ name: shot.name, ok: false, error: `download failed (${chosen.url})` });
        failed++;
        continue;
      }

      try {
        const outBuf = await sharp(raw)
          .rotate()
          .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
          .toBuffer();
        const file = `${shot.name}.jpg`;
        await writeFile(path.join(dir, file), outBuf);
        shotResults.push({
          name: shot.name,
          ok: true,
          file,
          bytes: outBuf.byteLength,
          source: { title: chosen.alt || shot.query, creator: chosen.photographer, url: chosen.url, landing: chosen.landing },
        });
        console.log(`✓ ${key} (${(outBuf.byteLength / 1024).toFixed(0)} KB)`);
        done++;
      } catch (e) {
        console.log(`✗ ${key}: sharp failed`);
        shotResults.push({ name: shot.name, ok: false, error: `sharp processing failed: ${(e as Error).message}` });
        failed++;
      }
    }

    const lines: string[] = [];
    lines.push(product.title);
    lines.push("=".repeat(product.title.length));
    lines.push("");
    if (product.note) {
      lines.push(`NAPOMENA: ${product.note}`);
      lines.push("");
    }
    lines.push("Fajlovi i izvor (Pexels License - besplatno za komercijalnu upotrebu):");
    for (const s of shotResults) {
      if (s.ok && s.source) {
        lines.push(`- ${s.file}  <-  "${s.source.title}" - photo by ${s.source.creator} (${s.source.landing})`);
      } else if (s.skipped) {
        lines.push(`- [NEDOSTAJE] ${s.name} - nije nadjena dobra slika, potrebno rucno traziti`);
      } else {
        lines.push(`- [GRESKA] ${s.name} - ${s.error}`);
      }
    }
    await writeFile(path.join(dir, "README.txt"), lines.join("\n"), "utf8");
  }

  console.log(`\n✅ Done. ${done} saved, ${skipped} skipped (need manual), ${failed} failed.`);
}

main().catch((e) => {
  console.error("❌ finalize failed:", e);
  process.exit(1);
});
