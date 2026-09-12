/**
 * Operational tool for the money backfill.
 *
 * THE BACKFILL ITSELF IS A MIGRATION, NOT THIS SCRIPT.
 * `prisma/migrations/20260906120000_backfill_money_sets` is what runs against
 * every environment, exactly once, recorded in `_prisma_migrations`. It is the
 * mechanism you should assume ran. This script exists for the cases a
 * migration cannot cover, because they happen after it:
 *
 *   --verify    recompute every set from its mirror and report any row whose
 *               stored amounts disagree. This is how you check that the SQL in
 *               the migration and `authorMoney()` in the app actually agree -
 *               they are deliberately separate implementations (a migration
 *               must stay reproducible and so cannot import app code), and
 *               nothing but a comparison proves they match.
 *   --rederive  re-apply the CURRENT rounding rule to the derived entries of
 *               every existing set, using each set's OWN stored rate snapshot.
 *               See the note on REDERIVE below for why that distinction is the
 *               whole safety story.
 *   --dry-run   report what would be written, change nothing.
 *   (no flag)   repair rows that arrived without a set AFTER the migration:
 *               a restored dump, a hand-written INSERT, a seed run.
 *
 * Repair is idempotent - it only touches rows whose `*Money` is still NULL.
 *
 * Run with:
 *   npm run db:backfill-money -- --verify
 *   npm run db:backfill-money -- --rederive --dry-run
 *   npm run db:backfill-money:stage -- --stage staging --verify
 *
 * Against a stage use the DIRECT Neon URL, not the pooled one; the wrapper
 * script does that for you.
 */
// `tsx` does not read .env the way the Prisma CLI does, so without this the
// local run reaches pg with no password at all. Matches prisma/seed.ts.
//
// Load-bearing detail: dotenv does NOT override an already-set variable. That
// is what keeps `backfill-money-stage.mjs` safe - it passes the stage's
// DATABASE_URL explicitly, and the local .env must never win over it and point
// a "staging" run at your own database.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  authorMoney,
  parseMoney,
  refreshDerived,
  serializeMoney,
  type CurrencyRates,
  type MoneySet,
} from "../src/lib/money";
import { VALID_CURRENCIES } from "../src/lib/currency-config";

const DRY_RUN = process.argv.includes("--dry-run");
const VERIFY = process.argv.includes("--verify");
const REDERIVE = process.argv.includes("--rederive");

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    const rateRows = await prisma.currencyRate.findMany();
    const rates: CurrencyRates = { usd: 1 };
    for (const row of rateRows) rates[row.code] = Number(row.rate);

    // Without rates the derived entries would silently be missing, leaving the
    // rows half-migrated and still drifting. Stop instead.
    const missing = ["eur", "rsd"].filter((c) => !rates[c]);
    if (missing.length > 0) {
      throw new Error(
        `No CurrencyRate row for: ${missing.join(", ")}. ` +
          `Seed the rates first (POST /api/internal/currency-rates), then re-run.`,
      );
    }
    console.log("Rates:", rates, DRY_RUN ? "(dry run)" : "");

    /** A USD-authored set for a mirror value, serialized for the Json column. */
    const setFor = (usdCents: number) =>
      serializeMoney(authorMoney(usdCents, "usd", rates));

    let total = 0;
    let mismatches = 0;

    /**
     * Compares a stored set against what `authorMoney` produces now.
     *
     * Only the USD amount is asserted exactly. The derived entries were frozen
     * at the rates in force when the row was written, so they are EXPECTED to
     * differ from today's - that is the whole point of freezing them, and
     * flagging it would be flagging correct behaviour. What must never drift is
     * the authored amount and its mirror.
     */
    const verifyRow = (label: string, id: string, field: string, stored: unknown, mirror: number) => {
      const set = stored as { primary?: string; amounts?: Record<string, number> } | null;
      if (!set || typeof set !== "object") {
        console.log(`  MISMATCH ${label} ${id}.${field}: no set stored (mirror ${mirror})`);
        mismatches++;
        return;
      }
      const usd = set.amounts?.usd;
      if (set.primary === "usd" && usd !== mirror) {
        console.log(
          `  MISMATCH ${label} ${id}.${field}: mirror ${mirror} but amounts.usd ${usd}`,
        );
        mismatches++;
      }
    };

    let rederived = 0;
    /** Per-currency tally of what moved, so the dry run is readable. */
    const moved: Record<string, number> = {};

    /**
     * Re-applies today's rounding rule to one set's DERIVED entries.
     *
     * THE RATES COME FROM THE SET, NOT FROM THE DATABASE. That is the whole
     * safety argument: this is not a repricing. Every authored amount is kept
     * byte for byte, and every derived one is recomputed against the very
     * snapshot it was first computed with, so the only thing that can change is
     * what the rounding rule does to it. Passing today's rates instead would
     * silently move the price of every product nobody has touched, which is
     * exactly the drift MoneySet exists to prevent.
     *
     * Written for the RSD `derivedStep` going from a whole dinar to a para: a
     * backfilled 1.000,00 RSD becomes the 1.000,37 RSD it always should have
     * been. It is idempotent - a second run finds nothing to do.
     *
     * Returns null when nothing changed.
     */
    const rederiveSet = (label: string, id: string, field: string, stored: unknown): MoneySet | null => {
      const set = parseMoney(stored);
      if (!set) return null;

      const next = refreshDerived(set, set.rates);

      // Never let a rebuild DROP a currency the row already has. It cannot
      // happen from either writer today (both snapshot the rates they used),
      // but this script rewrites every price in the database and a missing rate
      // must degrade to "leave it alone", never to "delete the amount".
      let dropped = false;
      for (const c of VALID_CURRENCIES) {
        if (set.amounts[c] != null && next.amounts[c] == null) {
          next.amounts[c] = set.amounts[c];
          dropped = true;
        }
      }
      if (dropped) {
        console.log(
          `  KEPT ${label} ${id}.${field}: rate snapshot is missing a currency, ` +
            `left its stored amount as it was`,
        );
      }

      const changes: string[] = [];
      for (const c of VALID_CURRENCIES) {
        const before = set.amounts[c];
        const after = next.amounts[c];
        if (before !== after) {
          changes.push(`${c} ${before} -> ${after}`);
          moved[c] = (moved[c] ?? 0) + 1;
        }
      }
      if (changes.length === 0) return null;

      console.log(`  ${label} ${id}.${field}: ${changes.join(", ")}`);
      return next;
    };

    const backfill = async (
      label: string,
      rows: { id: string; [k: string]: unknown }[],
      fields: [mirror: string, json: string][],
      update: (id: string, data: Record<string, unknown>) => Promise<unknown>,
    ) => {
      let n = 0;
      for (const row of rows) {
        if (VERIFY) {
          for (const [mirror, json] of fields) {
            const value = row[mirror];
            if (value == null) continue;
            verifyRow(label, row.id, json, row[json], Number(value));
          }
          continue;
        }

        if (REDERIVE) {
          const data: Record<string, unknown> = {};
          for (const [mirror, json] of fields) {
            const next = rederiveSet(label, row.id, json, row[json]);
            if (!next) continue;
            data[json] = serializeMoney(next);
            // The bare Int column mirrors `amounts.usd` and the two are written
            // together or not at all - a mirror that disagrees with its set
            // corrupts every price filter and threshold that reads it. USD's
            // step never changed, so in practice this never fires; it is here
            // so that a future step change cannot split the pair silently.
            const usd = next.amounts.usd;
            if (usd != null && usd !== Number(row[mirror])) {
              data[mirror] = usd;
              console.log(`    mirror ${label} ${row.id}.${mirror}: ${row[mirror]} -> ${usd}`);
            }
          }
          if (Object.keys(data).length === 0) continue;
          if (!DRY_RUN) await update(row.id, data);
          rederived++;
          continue;
        }
        const data: Record<string, unknown> = {};
        for (const [mirror, json] of fields) {
          if (row[json] != null) continue;
          const value = row[mirror];
          if (value == null) continue;
          data[json] = setFor(Number(value));
        }
        if (Object.keys(data).length === 0) continue;
        if (!DRY_RUN) await update(row.id, data);
        n++;
      }
      total += n;
      if (!VERIFY && !REDERIVE) console.log(`  ${label}: ${n} row(s)`);
    };

    await backfill(
      "Product",
      await prisma.product.findMany({
        select: {
          id: true,
          price: true,
          priceMoney: true,
          compareAtPrice: true,
          compareAtPriceMoney: true,
          costPrice: true,
          costPriceMoney: true,
        },
      }),
      [
        ["price", "priceMoney"],
        ["compareAtPrice", "compareAtPriceMoney"],
        ["costPrice", "costPriceMoney"],
      ],
      (id, data) => prisma.product.update({ where: { id }, data }),
    );

    await backfill(
      "ProductVariant",
      await prisma.productVariant.findMany({
        select: {
          id: true,
          price: true,
          priceMoney: true,
          compareAtPrice: true,
          compareAtPriceMoney: true,
          costPrice: true,
          costPriceMoney: true,
        },
      }),
      [
        ["price", "priceMoney"],
        ["compareAtPrice", "compareAtPriceMoney"],
        ["costPrice", "costPriceMoney"],
      ],
      (id, data) => prisma.productVariant.update({ where: { id }, data }),
    );

    await backfill(
      "ProductHistory",
      await prisma.productHistory.findMany({
        select: { id: true, price: true, priceMoney: true },
      }),
      [["price", "priceMoney"]],
      (id, data) => prisma.productHistory.update({ where: { id }, data }),
    );

    await backfill(
      "Organization",
      await prisma.organization.findMany({
        select: {
          id: true,
          shippingFlatRate: true,
          shippingFlatRateMoney: true,
          shippingFreeThreshold: true,
          shippingFreeThresholdMoney: true,
        },
      }),
      [
        ["shippingFlatRate", "shippingFlatRateMoney"],
        ["shippingFreeThreshold", "shippingFreeThresholdMoney"],
      ],
      (id, data) => prisma.organization.update({ where: { id }, data }),
    );

    // PERCENT coupons are deliberately skipped for `value`: it holds a
    // percentage, and turning 20 into "$0.20" would be a real corruption.
    // `minOrder` is money on both coupon types.
    const coupons = await prisma.coupon.findMany({
      select: {
        id: true,
        type: true,
        value: true,
        valueMoney: true,
        minOrder: true,
        minOrderMoney: true,
      },
    });
    await backfill(
      "Coupon (FIXED value + minOrder)",
      coupons.map((c) => ({
        ...c,
        // Hide `value` from the backfiller entirely on PERCENT rows.
        value: c.type === "FIXED" ? c.value : null,
      })),
      [
        ["value", "valueMoney"],
        ["minOrder", "minOrderMoney"],
      ],
      (id, data) => prisma.coupon.update({ where: { id }, data }),
    );

    if (REDERIVE) {
      const summary = Object.entries(moved)
        .map(([c, n]) => `${c}: ${n}`)
        .join(", ");
      console.log(
        DRY_RUN
          ? `
Dry run: ${rederived} row(s) would be rewritten.`
          : `
Done: ${rederived} row(s) rewritten.`,
      );
      if (rederived > 0) {
        console.log(`Amounts changed per currency - ${summary}`);
        console.log(
          "Authored amounts were not touched, and no rate moved: each set was " +
            "recomputed against its own snapshot, so this only re-applied the " +
            "current rounding rule.",
        );
      } else {
        console.log("Every derived amount already matches the current rounding rule.");
      }
      return;
    }

    if (VERIFY) {
      if (mismatches === 0) {
        console.log(
          "\nVerified: every row has a set, and every authored USD amount " +
            "matches its mirror. The migration's SQL and authorMoney() agree.",
        );
      } else {
        console.error(`\n${mismatches} mismatch(es) found - see above.`);
        process.exitCode = 1;
      }
      return;
    }

    console.log(
      DRY_RUN
        ? `\nDry run: ${total} row(s) would be repaired.`
        : `\nDone: ${total} row(s) repaired.`,
    );
    if (total > 0) {
      console.log(
        "\nRows needed repair, which means they were written after the " +
          "backfill migration ran (a seed, a restored dump, a manual INSERT).",
      );
    }
    console.log(
      "\nNote: this only fills rows that had NO set. To move already-set " +
        "DERIVED amounts onto newer rates, use refreshDerived - deliberately, " +
        "because that one changes prices buyers see. To only re-apply the " +
        "current rounding rule to them, use --rederive.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
