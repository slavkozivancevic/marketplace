/**
 * Backfill script: populates Product.searchText for all existing products.
 *
 * searchText is a denormalized blob (title + shortDescription + brand name +
 * category names) maintained by the application on product create/update.
 * Existing rows have NULL, so a one-time backfill is required after migration.
 *
 * Also useful as a recovery tool if brand/category renames have left rows stale -
 * passing `--all` re-populates every product, otherwise only NULL rows are touched.
 *
 * Run with:
 *   npx tsx scripts/backfill-product-search-text.ts
 *   npx tsx scripts/backfill-product-search-text.ts --all
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const all = process.argv.includes("--all");

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const products = await prisma.product.findMany({
      where: all ? {} : { searchText: null },
      select: {
        id: true,
        title: true,
        shortDescription: true,
        brand: { select: { name: true, translations: true } },
        categories: {
          select: { category: { select: { name: true, translations: true } } },
        },
      },
    });

    console.log(`Found ${products.length} products to backfill (mode: ${all ? "all" : "null-only"}).`);
    if (products.length === 0) {
      console.log("Nothing to do.");
      return;
    }

    const srName = (translations: unknown): string =>
      ((translations as { sr?: { name?: string } } | null)?.sr?.name ?? "").trim();

    let updated = 0;
    for (const p of products) {
      const parts = [
        p.title,
        p.shortDescription ?? "",
        p.brand?.name ?? "",
        srName(p.brand?.translations),
        ...p.categories.flatMap((c) => [c.category.name, srName(c.category.translations)]),
      ].filter((s) => s.trim().length > 0);

      await prisma.product.update({
        where: { id: p.id },
        data: { searchText: parts.join(" ") },
      });

      updated++;
      if (updated % 50 === 0) {
        console.log(`  Updated ${updated}/${products.length}...`);
      }
    }

    console.log(`Done. Backfilled ${updated} products.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});