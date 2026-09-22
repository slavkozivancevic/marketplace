/**
 * ONE-OFF RECOVERY SCRIPT - delete this file once it has run.
 *
 * Restores the "Toys & Kids" department deleted on 2026-09-21T22:43:16.837Z
 * (audit entry `category.deleted`, Category:8a215517-ca8b-4ad9-a622-b40e94e18d0e)
 * and re-parents the four subcategories the delete orphaned to the root level.
 *
 * Run:  npx tsx restore-toys-kids.ts
 *
 * It is idempotent: re-running it creates nothing twice and only re-points the
 * children, so it is safe to run again if it fails halfway.
 *
 * Where each value comes from:
 *   id        the audit trail (reused so slug history and any saved URL still
 *             resolve to this category)
 *   order 7   the gap in the root ordering - every other department is 1-6, 8, 9
 *   names     prisma/seed.ts, `departments` -> "toys-kids" (this database holds
 *             en + sr per category, no de/es, like every other category in it)
 *   slug      "toys-kids" in both locales, matching every seeded sibling
 *   image     prisma/seed.ts, same entry
 *   featured  seedCategories() creates every department with isFeatured: true
 *   attrs     prisma/seed.ts, departmentAttributes["toys-kids"]
 */
import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const ID = "8a215517-ca8b-4ad9-a622-b40e94e18d0e";
const IMAGE =
  "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=400&h=400&q=80&auto=format&fit=crop";
const CHILD_SLUGS = ["toys-games", "baby-toddler", "educational", "arts-crafts"];
const ATTR_KEYS = ["gender", "condition"];

async function main() {
  const existing = await prisma.category.findUnique({ where: { id: ID } });
  if (existing) console.log("Category already present - will only re-parent the children.");

  const attrs = await prisma.attribute.findMany({
    where: { key: { in: ATTR_KEYS } },
    select: { id: true, key: true },
  });
  const missing = ATTR_KEYS.filter((k) => !attrs.some((a) => a.key === k));
  if (missing.length) console.log(`(attributes not found, skipping those: ${missing.join(", ")})`);

  await prisma.$transaction(async (tx) => {
    if (!existing) {
      await tx.category.create({
        data: {
          id: ID,
          parentId: null,
          order: 7,
          isActive: true,
          isFeatured: true,
          imageUrl: IMAGE,
          translations: {
            create: [
              { locale: "en", name: "Toys & Kids", slug: "toys-kids", description: null },
              { locale: "sr", name: "Igračke i deca", slug: "toys-kids", description: null },
            ],
          },
          attributes: {
            create: attrs.map((a) => ({
              attributeId: a.id,
              order: ATTR_KEYS.indexOf(a.key),
              isFilterable: true,
            })),
          },
        },
      });
      console.log("created the department");
    }

    for (const slug of CHILD_SLUGS) {
      const child = await tx.categoryTranslation.findFirst({
        where: { locale: "en", slug },
        select: { categoryId: true },
      });
      if (!child) {
        console.log(`!! subcategory "${slug}" not found - check it by hand`);
        continue;
      }
      const updated = await tx.category.update({
        where: { id: child.categoryId },
        data: { parentId: ID },
        select: { order: true },
      });
      console.log(`re-parented ${slug} (order=${updated.order})`);
    }
  });

  const check = await prisma.category.findUnique({
    where: { id: ID },
    select: {
      id: true,
      order: true,
      isActive: true,
      isFeatured: true,
      imageUrl: true,
      translations: { select: { locale: true, name: true, slug: true } },
      attributes: { select: { order: true, attribute: { select: { key: true } } } },
      children: {
        orderBy: { order: "asc" },
        select: { order: true, translations: { where: { locale: "en" }, select: { name: true } } },
      },
    },
  });
  console.log("\n=== restored ===");
  console.log(JSON.stringify(check, null, 2));
  console.log(
    "\nRestart the dev server afterwards: the category tree is cached with cacheLife(\"max\"),\n" +
      "and a write made outside the app cannot invalidate that tag.",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
