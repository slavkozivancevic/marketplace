/**
 * Backfills Product.warrantyMonths / Product.countryOfOrigin on a real stage's
 * database (staging Neon).
 *
 * Data-only and deliberately partial: 18 products are left fully unspecified
 * and a few carry only one of the two values, so the storefront still
 * exercises the "not specified" rendering path and the facet counts are not
 * uniform. Values are picked to land on the WARRANTY_BUCKETS ladder
 * (6/12/24/36/60, plus 0 = explicitly no warranty) so every filter threshold
 * in src/lib/query/searchParams.ts has matches.
 *
 * Resolves the stage's DatabaseUrl the way scripts/migrate-stage.mjs does
 * (sst secret list -> direct, non-pooled endpoint), so it can never fall
 * through to the local .env by accident.
 *
 * Idempotent: by default a column is written only when it is currently NULL,
 * so re-running never stomps on edits made in the UI afterwards. Pass --force
 * to overwrite with the table below.
 *
 * Usage:
 *   node scripts/staging/warranty-origin.mjs --stage staging --dump
 *   node scripts/staging/warranty-origin.mjs --stage staging --apply [--force]
 */
import { execFileSync } from "node:child_process";
import pg from "pg";

// [english title, warrantyMonths | null, ISO 3166-1 alpha-2 | null]
const DATA = [
  // Smartphones and tablets
  ["Aurora X1 5G Smartphone", 24, "VN"],
  ["Budget Phone Lite", 24, "IN"],
  ["Foldable Phone Z", 24, "VN"],
  ["Galaxy Phone S", 24, "VN"],
  ["Pro Max Smartphone", 12, "CN"],
  ["Tablet Air 11", 12, "CN"],
  ["Mini Tablet 8", 24, "VN"],
  // Laptops and computers
  ["Convertible 2-in-1", 24, "CN"],
  ["Gaming Notebook X", 24, "CN"],
  ["Office Laptop 15", 24, "CN"],
  ["Student Chromebook", 12, "VN"],
  ["UltraBook Pro 14", 24, "KR"],
  ["Workstation Tower", 36, "MX"],
  // TV and audio
  ["4K Smart TV 55", 24, "SK"],
  ["OLED TV 65", 24, "PL"],
  ["Soundbar 2.1", 24, "MY"],
  ["Bluetooth Speaker", 12, "CN"],
  ["Noise-Cancel Earbuds", 12, "VN"],
  ["Wireless Headphones", 24, "MY"],
  ["Studio Over-Ear", 12, "CN"],
  // Cameras
  ["DSLR Kit", 24, "JP"],
  ["Mirrorless Camera", 24, "TH"],
  ["Vlogging Camera", 24, "JP"],
  ["Action Camera 4K", 12, "CN"],
  // Gaming
  ["Game Console X", 12, "CN"],
  ["Wireless Controller", 12, "CN"],
  ["Gaming Headset", 24, "CN"],
  ["Mechanical Keyboard", 24, "TW"],
  // Car electronics
  ["Dash Cam 1080p", 12, "CN"],
  ["Car Bluetooth Adapter", null, null],
  // Tools
  ["Cordless Drill 18V", 36, "DE"],
  ["Socket Wrench Set", 60, "TW"],
  // Kitchen and dining
  ["Espresso Machine", 24, "PT"],
  ["Non-Stick Pan Set", 24, "CN"],
  ["Stainless Knife Block", 12, null],
  ["Ceramic Dinnerware Set", 0, "PT"],
  // Furniture
  ["Fabric Sofa 3-Seat", 60, "PL"],
  ["Ergonomic Office Chair", 60, "CN"],
  ["Bookshelf 5-Tier", 24, "PL"],
  ["Oak Coffee Table", 24, "LT"],
  // Home decor
  ["Area Rug 160x230", 12, "IN"],
  ["Scented Candle Set", null, null],
  ["Woven Wall Art", null, null],
  // Exercise and fitness
  ["Adjustable Dumbbells", 24, null],
  ["Foam Roller", 12, "CN"],
  ["Resistance Band Set", 6, "CN"],
  ["Yoga Mat Pro", 12, "CN"],
  // Outdoor recreation
  ["2-Person Tent", 24, null],
  ["Hiking Backpack 40L", 24, "VN"],
  ["Insulated Water Bottle", 12, "CN"],
  // Cycling
  ["Mountain Bike 29", 60, "TW"],
  ["Cycling Helmet", 24, "IT"],
  // Shoes
  ["Court Sneakers", 6, "VN"],
  ["Running Sneakers", 6, "VN"],
  ["Trail Hiking Shoes", 6, "VN"],
  ["Canvas Low-Tops", 0, "ID"],
  ["Leather Boots", 12, "PT"],
  // Menswear
  ["Classic Cotton T-Shirt", 0, "TR"],
  ["Classic Cotton Crewneck T-Shirt", 0, "PT"],
  ["Hooded Sweatshirt", 0, "BD"],
  ["Chino Trousers", null, null],
  ["Oxford Shirt", null, null],
  ["Slim Fit Jeans", 0, "MX"],
  ["Wool Blazer", 12, "ES"],
  // Womenswear
  ["High-Waist Jeans", 0, "TR"],
  ["Knit Sweater", null, null],
  ["Silk Blouse", null, null],
  ["Summer Dress", null, null],
  ["Trench Coat", 12, "TR"],
  ["Yoga Leggings", 6, "VN"],
  // Kidswear
  ["Kids Graphic Tee", null, null],
  ["Kids Hoodie", null, "CN"],
  ["Kids Joggers", null, "KH"],
  // Bags and accessories
  ["Crossbody Bag", null, null],
  ["Leather Backpack", 24, "ES"],
  ["Leather Wallet", null, null],
  ["Tote Bag", null, null],
  // Books
  ["Atomic Habits", null, "GB"],
  ["Clean Architecture", null, "US"],
  ["Cooking Basics", null, null],
  ["The Pragmatic Developer", null, "US"],
  // Video games
  ["Open World RPG", 0, "PL"],
  ["Racing Sim 2026", null, null],
  // Toys and games
  ["Building Bricks 1000pc", 24, "DK"],
  ["Remote Control Car", 12, "CN"],
  ["Wooden Train Set", 0, "PL"],
  ["Board Game Night", null, null],
  // Baby and toddler
  ["Soft Activity Cube", 12, "CN"],
  ["Stroller Lite", 24, "PL"],
  // Beauty
  ["Eau de Parfum Noir", null, "FR"],
  ["Fresh Citrus Cologne", null, null],
  ["Hydrating Serum", null, null],
  ["SPF 50 Sunscreen", null, "KR"],
  ["Vitamin C Cream", null, null],
];

const args = process.argv.slice(2);
const stageIdx = args.indexOf("--stage");
const stage = stageIdx !== -1 ? args[stageIdx + 1] : null;
const mode = args.includes("--apply") ? "apply" : "dump";
const force = args.includes("--force");
if (!stage) {
  console.error(
    "Usage: node scripts/staging/warranty-origin.mjs --stage <stage> [--dump|--apply] [--force]"
  );
  process.exit(1);
}

function stageDatabaseUrl(stage) {
  const out = execFileSync("npx", ["sst", "secret", "list", "--stage", stage], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const match = out.match(/^DatabaseUrl=(.+)$/m);
  if (!match) throw new Error(`No DatabaseUrl secret for stage "${stage}"`);
  return match[1].trim().replace(/-pooler(?=\.)/, "");
}

const client = new pg.Client({ connectionString: stageDatabaseUrl(stage) });
await client.connect();

const { rows } = await client.query(`
  SELECT p.id, t.title, p."warrantyMonths", p."countryOfOrigin"
    FROM "Product" p
    JOIN "ProductTranslation" t ON t."productId" = p.id AND t.locale = 'en'
   WHERE p."deletedAt" IS NULL
   ORDER BY t.title
`);

const byTitle = new Map();
for (const r of rows) {
  if (byTitle.has(r.title)) throw new Error(`Ambiguous english title: ${r.title}`);
  byTitle.set(r.title, r);
}

if (mode === "dump") {
  for (const r of rows) {
    console.log(`${r.title} :: ${r.warrantyMonths ?? "-"} :: ${r.countryOfOrigin ?? "-"}`);
  }
  await client.end();
  process.exit(0);
}

const missing = DATA.filter(([title]) => !byTitle.has(title)).map(([title]) => title);
if (missing.length) {
  console.error(`Unknown product titles (catalog changed?):\n  ${missing.join("\n  ")}`);
  await client.end();
  process.exit(1);
}
for (const r of rows) {
  if (!DATA.some(([title]) => title === r.title)) {
    console.warn(`  ! not in the table, left untouched: ${r.title}`);
  }
}

let updated = 0;
let unspecified = 0;
await client.query("BEGIN");
try {
  for (const [title, months, origin] of DATA) {
    if (months === null && origin === null) {
      unspecified++;
      continue;
    }
    const row = byTitle.get(title);
    const res = await client.query(
      force
        ? `UPDATE "Product"
              SET "warrantyMonths" = $2, "countryOfOrigin" = $3
            WHERE id = $1`
        : `UPDATE "Product"
              SET "warrantyMonths" = CASE WHEN "warrantyMonths" IS NULL THEN $2 ELSE "warrantyMonths" END,
                  "countryOfOrigin" = CASE WHEN "countryOfOrigin" IS NULL THEN $3 ELSE "countryOfOrigin" END
            WHERE id = $1
              AND ("warrantyMonths" IS NULL OR "countryOfOrigin" IS NULL)`,
      [row.id, months, origin]
    );
    if (res.rowCount) updated++;
  }
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
}

console.log(`\n${updated} products updated, ${unspecified} left unspecified on purpose.`);

const summary = await client.query(`
  SELECT COUNT(*)::int AS total,
         COUNT("warrantyMonths")::int AS with_warranty,
         COUNT("countryOfOrigin")::int AS with_origin
    FROM "Product" WHERE "deletedAt" IS NULL
`);
console.log(summary.rows[0]);

const buckets = await client.query(`
  SELECT b.months, COUNT(p.id)::int AS products
    FROM (VALUES (6),(12),(24),(36),(60)) AS b(months)
    LEFT JOIN "Product" p ON p."deletedAt" IS NULL AND p."warrantyMonths" >= b.months
   GROUP BY b.months ORDER BY b.months
`);
console.log("warranty buckets (>= months):");
for (const b of buckets.rows) console.log(`  ${b.months}+ : ${b.products}`);

const origins = await client.query(`
  SELECT "countryOfOrigin" AS code, COUNT(*)::int AS products
    FROM "Product" WHERE "deletedAt" IS NULL AND "countryOfOrigin" IS NOT NULL
   GROUP BY 1 ORDER BY 2 DESC, 1
`);
console.log(`origins (${origins.rows.length} countries):`);
console.log("  " + origins.rows.map((o) => `${o.code}:${o.products}`).join("  "));

await client.end();
