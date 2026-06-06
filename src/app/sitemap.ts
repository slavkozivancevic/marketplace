import type { MetadataRoute } from "next";
import { prisma } from "@/core/db/prisma";
import { env } from "@/env/server";
import { routing } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";

/**
 * Sitemap with per-locale entries and hreflang `alternates` so each URL
 * variant gets crawled and indexed for its language. We emit one entry per
 * page per locale plus a Google `x-default` hint pointing at the default
 * locale's URL.
 *
 * Coverage: static pages, the product catalog, brand directory + detail
 * pages, and active category detail pages. All slugs are pulled from the
 * per-entity translation tables, so the alternates always reflect the
 * actual URLs an admin set for each locale.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.APP_URL.replace(/\/$/, "");
  const now = new Date();

  function urlFor(pathname: string, locale: (typeof routing.locales)[number]) {
    return `${baseUrl}${getPathname({ href: pathname as never, locale })}`;
  }

  function staticEntry(
    pathname: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  ): MetadataRoute.Sitemap {
    return routing.locales.map((locale) => {
      const languages: Record<string, string> = {};
      for (const l of routing.locales) {
        languages[l] = urlFor(pathname, l);
      }
      languages["x-default"] = urlFor(pathname, routing.defaultLocale);
      return {
        url: urlFor(pathname, locale),
        lastModified: now,
        changeFrequency,
        priority,
        alternates: { languages },
      };
    });
  }

  // Per-detail-entity helper: builds one entry per locale for a single
  // entity, with full hreflang alternates pointing at the same entity's
  // URL in every other locale. Used by products / brands / categories.
  function entityEntries(
    pathname: "/products/[slug]" | "/brands/[slug]" | "/categories/[slug]",
    rows: { locale: string; slug: string; updatedAt: Date }[],
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  ): MetadataRoute.Sitemap {
    const languages: Record<string, string> = {};
    for (const row of rows) {
      languages[row.locale] = `${baseUrl}${getPathname({
        href: { pathname, params: { slug: row.slug } },
        locale: row.locale as (typeof routing.locales)[number],
      })}`;
    }
    const defaultRow = rows.find((r) => r.locale === routing.defaultLocale) ?? rows[0];
    languages["x-default"] = languages[defaultRow.locale];

    return rows.map((row) => ({
      url: languages[row.locale],
      lastModified: row.updatedAt,
      changeFrequency,
      priority,
      alternates: { languages },
    }));
  }

  const staticEntries: MetadataRoute.Sitemap = [
    ...staticEntry("/", 1.0, "daily"),
    ...staticEntry("/products", 0.9, "daily"),
    ...staticEntry("/brands", 0.7, "weekly"),
  ];

  // ---------- Products ----------
  const productTranslations = await prisma.productTranslation.findMany({
    where: { product: { status: "PUBLISHED", deletedAt: null } },
    select: {
      locale: true,
      slug: true,
      productId: true,
      product: { select: { updatedAt: true } },
    },
  });
  const productsByEntity = groupByEntity(
    productTranslations.map((r) => ({
      entityId: r.productId,
      locale: r.locale,
      slug: r.slug,
      updatedAt: r.product.updatedAt,
    })),
  );
  const productEntries: MetadataRoute.Sitemap = [];
  for (const rows of productsByEntity.values()) {
    productEntries.push(...entityEntries("/products/[slug]", rows, 0.7, "weekly"));
  }

  // ---------- Brands ----------
  // Only emit brands that have at least one published product - empty
  // brand pages give crawlers nothing to index and dilute SEO weight.
  const brandTranslations = await prisma.brandTranslation.findMany({
    where: {
      brand: {
        products: { some: { status: "PUBLISHED", deletedAt: null } },
      },
    },
    select: {
      locale: true,
      slug: true,
      brandId: true,
      brand: { select: { updatedAt: true } },
    },
  });
  const brandsByEntity = groupByEntity(
    brandTranslations.map((r) => ({
      entityId: r.brandId,
      locale: r.locale,
      slug: r.slug,
      updatedAt: r.brand.updatedAt,
    })),
  );
  const brandEntries: MetadataRoute.Sitemap = [];
  for (const rows of brandsByEntity.values()) {
    brandEntries.push(...entityEntries("/brands/[slug]", rows, 0.6, "weekly"));
  }

  // ---------- Categories ----------
  // Only active categories whose branch holds at least one published product.
  // A category page lists products from its whole subtree (it resolves to the
  // descendant id set), so a parent with no direct products but non-empty
  // children still counts. We find the categories that directly hold a
  // published product, then propagate that flag up the parent chain. Empty
  // categories are dropped - thin pages dilute SEO, same rationale as brands.
  const [activeCategories, categoriesWithDirectProducts] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, parentId: true },
    }),
    prisma.category.findMany({
      where: {
        isActive: true,
        products: {
          some: { product: { status: "PUBLISHED", deletedAt: null } },
        },
      },
      select: { id: true },
    }),
  ]);

  const parentOf = new Map(activeCategories.map((c) => [c.id, c.parentId]));
  const nonEmptyCategoryIds = new Set<string>();
  for (const { id } of categoriesWithDirectProducts) {
    // Walk up the active parent chain so ancestors of a non-empty category
    // are kept too; stop at the first already-seen node to avoid rework.
    let current: string | null | undefined = id;
    while (current && !nonEmptyCategoryIds.has(current)) {
      nonEmptyCategoryIds.add(current);
      current = parentOf.get(current);
    }
  }

  const categoryTranslations = await prisma.categoryTranslation.findMany({
    where: { category: { isActive: true } },
    select: {
      locale: true,
      slug: true,
      categoryId: true,
      category: { select: { updatedAt: true } },
    },
  });
  const categoriesByEntity = groupByEntity(
    categoryTranslations
      .filter((r) => nonEmptyCategoryIds.has(r.categoryId))
      .map((r) => ({
        entityId: r.categoryId,
        locale: r.locale,
        slug: r.slug,
        updatedAt: r.category.updatedAt,
      })),
  );
  const categoryEntries: MetadataRoute.Sitemap = [];
  for (const rows of categoriesByEntity.values()) {
    categoryEntries.push(
      ...entityEntries("/categories/[slug]", rows, 0.6, "weekly"),
    );
  }

  return [
    ...staticEntries,
    ...productEntries,
    ...brandEntries,
    ...categoryEntries,
  ];
}

type EntityRow = { entityId: string; locale: string; slug: string; updatedAt: Date };

/** Buckets a flat list of translation rows by entity id. */
function groupByEntity(rows: EntityRow[]): Map<string, EntityRow[]> {
  const out = new Map<string, EntityRow[]>();
  for (const row of rows) {
    const list = out.get(row.entityId) ?? [];
    list.push(row);
    out.set(row.entityId, list);
  }
  return out;
}
