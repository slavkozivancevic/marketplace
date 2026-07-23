// Re-searches the shots flagged REQUERY:<new query> in decisions.json with a
// fresh query, building a contact sheet for each so they can be reviewed the
// same way as the first pass. Candidates are written to
// requery-candidates.json (kept separate from the first pass's candidates.json).
//
// Run: PEXELS_API_KEY=... npx tsx scripts/staging/images/requery.ts
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OverlayOptions } from "sharp";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
if (!PEXELS_API_KEY) throw new Error("PEXELS_API_KEY env var is required");

const REVIEW_DIR = process.env.REVIEW_DIR ?? path.join(process.cwd(), ".image-review");
const CELL = 300;
const COLS = 3;
const ROWS = 2;
const GAP = 8;
const LABEL_H = 34;
const TITLE_H = 40;

type Candidate = {
  index: number;
  url: string;
  thumb: string;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  photographer_url: string;
  landing: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function searchPexels(query: string): Promise<Candidate[]> {
  const url = `https://api.pexels.com/v1/search?${new URLSearchParams({ query, per_page: "6" })}`;
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
      src: { large2x: string; medium: string };
    }[];
  };
  return (json.photos ?? []).map((p, i) => ({
    index: i + 1,
    url: p.src.large2x,
    thumb: p.src.medium,
    width: p.width,
    height: p.height,
    alt: p.alt || "",
    photographer: p.photographer,
    photographer_url: p.photographer_url,
    landing: p.url,
  }));
}

async function fetchBuf(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function svgText(text: string, w: number, h: number, opts: { size: number; bg: string; fg: string }): Buffer {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${opts.bg}"/>
      <text x="8" y="${h / 2 + opts.size / 3}" font-family="Arial, sans-serif" font-size="${opts.size}" fill="${opts.fg}">${esc}</text>
    </svg>`,
  );
}

function svgBadge(n: number): Buffer {
  return Buffer.from(
    `<svg width="30" height="30" xmlns="http://www.w3.org/2000/svg">
      <circle cx="15" cy="15" r="14" fill="black" fill-opacity="0.72"/>
      <text x="15" y="21" font-family="Arial, sans-serif" font-size="16" fill="white" text-anchor="middle">${n}</text>
    </svg>`,
  );
}

async function main() {
  const sharp = (await import("sharp")).default;
  const decisions = JSON.parse(await readFile(path.join(REVIEW_DIR, "decisions.json"), "utf8")) as Record<string, number | string>;

  const requeryEntries = Object.entries(decisions).filter(
    (e): e is [string, string] => typeof e[1] === "string" && e[1].startsWith("REQUERY:"),
  );
  console.log(`${requeryEntries.length} shots to requery`);

  const requeryCandidates: Record<string, Candidate[]> = {};

  for (const [key, val] of requeryEntries) {
    const query = val.slice("REQUERY:".length);
    process.stdout.write(`${key} :: "${query}" ... `);
    const candidates = await searchPexels(query);
    if (candidates.length === 0) {
      console.log("NO RESULTS");
      requeryCandidates[key] = [];
      await sleep(250);
      continue;
    }
    requeryCandidates[key] = candidates;

    const cellsBuf = await Promise.all(
      candidates.map(async (c) => {
        const raw = await fetchBuf(c.thumb);
        const img = raw
          ? await sharp(raw).resize(CELL, CELL - LABEL_H, { fit: "cover" }).jpeg().toBuffer()
          : await sharp(svgText("(failed)", CELL, CELL - LABEL_H, { size: 16, bg: "#333", fg: "#fff" })).jpeg().toBuffer();
        return img;
      }),
    );

    const sheetW = COLS * CELL + (COLS + 1) * GAP;
    const sheetH = TITLE_H + ROWS * CELL + (ROWS + 1) * GAP;
    const composites: OverlayOptions[] = [];
    composites.push({
      input: svgText(`[REQUERY] ${key}  ::  "${query}"`, sheetW, TITLE_H, { size: 15, bg: "#3a2a15", fg: "#f1eef8" }),
      left: 0,
      top: 0,
    });
    for (let i = 0; i < candidates.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const left = GAP + col * (CELL + GAP);
      const top = TITLE_H + GAP + row * (CELL + GAP);
      composites.push({ input: cellsBuf[i], left, top: top + LABEL_H });
      composites.push({
        input: svgText(`#${candidates[i].index}  ${candidates[i].width}x${candidates[i].height}`, CELL, LABEL_H, {
          size: 13,
          bg: "#efe9f7",
          fg: "#211c30",
        }),
        left,
        top,
      });
      composites.push({ input: svgBadge(candidates[i].index), left: left + CELL - 34, top: top + LABEL_H + 4 });
    }

    const sheet = sharp({ create: { width: sheetW, height: sheetH, channels: 3, background: "#332c47" } }).composite(composites);
    const file = `REQUERY__${key}.jpg`;
    await sheet.jpeg({ quality: 78 }).toFile(path.join(REVIEW_DIR, file));
    console.log(`ok (${candidates.length} candidates)`);
    await sleep(250);
  }

  await writeFile(path.join(REVIEW_DIR, "requery-candidates.json"), JSON.stringify(requeryCandidates, null, 2), "utf8");
  console.log(`\n✅ ${requeryEntries.length} requery sheets written`);
}

main().catch((e) => {
  console.error("❌ failed:", e);
  process.exit(1);
});
