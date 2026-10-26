/**
 * Seeds the storefront promises from #22 on a real stage's database (staging
 * Neon): the platform-wide trust strip (TrustPoint + TrustPointTranslation) and
 * each seller's delivery lead time (Organization.leadTimeMinDays/MaxDays).
 *
 * Trust points say only what the PLATFORM stands behind - payment, cash on
 * delivery, verified sellers, returns. Delivery cost and delivery time are the
 * seller's promises and live on Organization, so none of them appear here.
 *
 * Resolves the stage's DatabaseUrl the way scripts/migrate-stage.mjs does
 * (sst secret list -> direct, non-pooled endpoint), so it can never fall
 * through to the local .env by accident.
 *
 * Idempotent: trust points are inserted only while the table is empty, and a
 * lead time is written only where both columns are still NULL, so re-running
 * never stomps on edits made in the UI afterwards.
 *
 * Writes go straight to the database, past the Server Actions, so no cache tag
 * is invalidated: the storefront keeps serving its cached (empty) strip until
 * the next deploy starts a fresh cache.
 *
 * Usage:
 *   node scripts/staging/storefront-promises.mjs --stage staging --dump
 *   node scripts/staging/storefront-promises.mjs --stage staging --apply
 */
import { execFileSync } from "node:child_process";
import pg from "pg";

// [icon, order, { locale: [label, sublabel | null] }]
const TRUST_POINTS = [
  [
    "shield",
    0,
    {
      en: ["Secure payment", "Cards processed by Stripe"],
      sr: ["Sigurno plaćanje", "Kartice obrađuje Stripe"],
      de: ["Sichere Zahlung", "Karten über Stripe abgewickelt"],
      es: ["Pago seguro", "Tarjetas procesadas por Stripe"],
    },
  ],
  [
    "wallet",
    1,
    {
      en: ["Cash on delivery", "Pay when the parcel arrives"],
      sr: ["Plaćanje pouzećem", "Platite kad paket stigne"],
      de: ["Zahlung bei Lieferung", "Bezahlen, wenn das Paket ankommt"],
      es: ["Pago contra reembolso", "Paga cuando llegue el paquete"],
    },
  ],
  [
    "verified",
    2,
    {
      en: ["Verified sellers", "Every shop is checked before it sells"],
      sr: ["Provereni prodavci", "Svaka prodavnica prolazi proveru"],
      de: ["Geprüfte Verkäufer", "Jeder Shop wird vorab geprüft"],
      es: ["Vendedores verificados", "Cada tienda se revisa antes de vender"],
    },
  ],
  [
    "returns",
    3,
    {
      en: ["Easy returns", "Within the seller's return window"],
      sr: ["Jednostavan povraćaj", "U roku koji navodi prodavac"],
      de: ["Einfache Rückgabe", "Innerhalb der Frist des Verkäufers"],
      es: ["Devoluciones fáciles", "Dentro del plazo del vendedor"],
    },
  ],
];

// Organization name -> [leadTimeMinDays, leadTimeMaxDays]. An org not listed
// here keeps NULL, which the storefront renders as no promise at all.
// Only verified orgs: an unverified one cannot sell, so a promise there would
// never be shown.
const LEAD_TIMES = {
  "Slavko Zivancevic's Proton Organization": [2, 5],
  "Demo Store": [3, 7],
  "Tech Haven": [1, 3],
  "Toma Zivancevic's Organization": [2, 4],
};

const args = process.argv.slice(2);
const stageIdx = args.indexOf("--stage");
const stage = stageIdx !== -1 ? args[stageIdx + 1] : null;
const mode = args.includes("--apply") ? "apply" : "dump";
if (!stage) {
  console.error(
    "Usage: node scripts/staging/storefront-promises.mjs --stage <stage> [--dump|--apply]"
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

async function report() {
  const tp = await client.query(`
    SELECT p.icon, p."order", p."isActive", t.locale, t.label, t.sublabel
      FROM "TrustPoint" p
      LEFT JOIN "TrustPointTranslation" t ON t."trustPointId" = p.id
     ORDER BY p."order", t.locale
  `);
  console.log(`trust point translations: ${tp.rows.length}`);
  for (const r of tp.rows) {
    console.log(`  ${r.order} ${r.icon} ${r.isActive ? "" : "(inactive) "}${r.locale}: ${r.label} / ${r.sublabel ?? "-"}`);
  }

  const orgs = await client.query(`
    SELECT o.name, o.verified, o."leadTimeMinDays", o."leadTimeMaxDays", o."returnWindowDays",
           COUNT(p.id)::int AS products
      FROM "Organization" o
      LEFT JOIN "Product" p ON p."organizationId" = o.id AND p."deletedAt" IS NULL
     GROUP BY o.id
     ORDER BY products DESC, o.name
  `);
  console.log(`organizations: ${orgs.rows.length}`);
  for (const o of orgs.rows) {
    const lead = o.leadTimeMinDays == null ? "-" : `${o.leadTimeMinDays}-${o.leadTimeMaxDays}`;
    console.log(`  ${o.name} :: verified=${o.verified} :: products=${o.products} :: lead=${lead} :: returns=${o.returnWindowDays}`);
  }
}

if (mode === "dump") {
  await report();
  await client.end();
  process.exit(0);
}

await client.query("BEGIN");
try {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM "TrustPoint"`);
  if (rows[0].n > 0) {
    console.log(`TrustPoint already holds ${rows[0].n} rows - left untouched.`);
  } else {
    for (const [icon, order, translations] of TRUST_POINTS) {
      const created = await client.query(
        `INSERT INTO "TrustPoint" (id, icon, "order", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, true, NOW(), NOW())
         RETURNING id`,
        [icon, order]
      );
      for (const [locale, [label, sublabel]] of Object.entries(translations)) {
        await client.query(
          `INSERT INTO "TrustPointTranslation" (id, "trustPointId", locale, label, sublabel)
           VALUES (gen_random_uuid(), $1, $2, $3, $4)`,
          [created.rows[0].id, locale, label, sublabel]
        );
      }
    }
    console.log(`${TRUST_POINTS.length} trust points inserted.`);
  }

  let leadUpdated = 0;
  for (const [name, [min, max]] of Object.entries(LEAD_TIMES)) {
    const res = await client.query(
      `UPDATE "Organization"
          SET "leadTimeMinDays" = $2, "leadTimeMaxDays" = $3
        WHERE name = $1
          AND "leadTimeMinDays" IS NULL AND "leadTimeMaxDays" IS NULL`,
      [name, min, max]
    );
    leadUpdated += res.rowCount;
  }
  console.log(`${leadUpdated} organizations got a lead time.`);

  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
}

console.log("");
await report();
await client.end();
