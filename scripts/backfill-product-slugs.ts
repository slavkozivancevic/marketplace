// /**
//  * Backfill script: generates slug for all Product rows where slug IS NULL.
//  *
//  * Run with:
//  *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/backfill-product-slugs.ts
//  *
//  * Enterprise pattern: add nullable column → backfill data → make NOT NULL.
//  * This is step 2 of 3.
//  */

// import { PrismaClient } from "@/generated/prisma/client";
// import { PrismaPg } from "@prisma/adapter-pg";

// function slugify(text: string): string {
//   return text
//     .toLowerCase()
//     .normalize("NFD")
//     .replace(/[\u0300-\u036f]/g, "")
//     .replace(/[^a-z0-9\s-]/g, "")
//     .trim()
//     .replace(/[\s]+/g, "-")
//     .replace(/-+/g, "-");
// }

// async function main() {
//   const adapter = new PrismaPg({
//     connectionString: process.env.DATABASE_URL!,
//   });

//   const prisma = new PrismaClient({ adapter });

//   try {
//     const products = await prisma.product.findMany({
//       where: { slug: null },
//       select: { id: true, title: true, organizationId: true },
//     });

//     console.log(`Found ${products.length} products without a slug.`);

//     if (products.length === 0) {
//       console.log("Nothing to backfill.");
//       return;
//     }

//     // Track slugs already used per org to avoid duplicates within this batch.
//     const usedSlugs = new Map<string, Set<string>>();

//     // Also load existing slugs from DB per org so we don't collide with existing ones.
//     const orgs = [...new Set(products.map((p) => p.organizationId))];
//     for (const orgId of orgs) {
//       const existing = await prisma.product.findMany({
//         where: { organizationId: orgId, slug: { not: null } },
//         select: { slug: true },
//       });
//       usedSlugs.set(orgId, new Set(existing.map((p) => p.slug as string)));
//     }

//     let updated = 0;

//     for (const product of products) {
//       const orgSlugs = usedSlugs.get(product.organizationId)!;
//       let base = slugify(product.title) || product.id;
//       let slug = base;

//       // Append short id suffix on collision.
//       if (orgSlugs.has(slug)) {
//         const suffix = product.id.slice(-6);
//         slug = `${base}-${suffix}`;
//       }

//       // Extremely unlikely, but guard against a double collision.
//       if (orgSlugs.has(slug)) {
//         slug = product.id;
//       }

//       await prisma.product.update({
//         where: { id: product.id },
//         data: { slug },
//       });

//       orgSlugs.add(slug);
//       updated++;

//       if (updated % 50 === 0) {
//         console.log(`  Updated ${updated}/${products.length}...`);
//       }
//     }

//     console.log(`Done. Backfilled ${updated} products.`);
//   } finally {
//     await prisma.$disconnect();
//   }
// }

// main().catch((err) => {
//   console.error(err);
//   process.exit(1);
// });
