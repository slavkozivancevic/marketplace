import { prisma } from "@/core/db/prisma";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { assertNotInUse } from "@/features/common/db/assertNotInUse";
import { revalidateCategoryCache } from "./cache";
import { slugify } from "@/lib/utils";
import { copyName } from "@/lib/i18n/copyName";
import { copyIdentifier } from "@/lib/copyIdentifier";
import { CATEGORY_NAME_MAX_LENGTH, CATEGORY_SLUG_MAX_LENGTH } from "../schema/categories";
import { refreshProductSearchText } from "@/features/products/db/products";
import { recordSlugChanges } from "@/lib/seo/slugHistory";
import { createWithUniqueSlugRetry } from "@/lib/db/uniqueSlugRetry";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from "@/i18n/config";
import { pruneEmptyCategories } from "../utils/pruneEmpty";

// ---------- Translation types & helpers ----------

export type { CategoryTranslations } from "../utils/translations";
export {
  getCategoryName,
  getCategorySlug,
  getCategoryDescription,
} from "../utils/translations";
import type { CategoryTranslations } from "../utils/translations";

type CategoryTranslationRow = {
  locale: string;
  name: string;
  slug: string;
  description: string | null;
};

// ---------- Tree types ----------

export type CategoryTreeItem = {
  id: string;
  imageUrl: string | null;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
  translations: CategoryTranslationRow[];
  children: CategoryTreeItem[];
};

// ---------- Tree helpers ----------

function buildTree(
  rows: (Omit<CategoryTreeItem, "children"> & { parentId: string | null })[],
): CategoryTreeItem[] {
  const map = new Map<string, CategoryTreeItem>();
  for (const row of rows) {
    map.set(row.id, { ...row, children: [] });
  }

  const roots: CategoryTreeItem[] = [];
  for (const row of rows) {
    const node = map.get(row.id)!;
    if (row.parentId) {
      map.get(row.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function defaultSlug(rows: readonly CategoryTranslationRow[]): string {
  return (
    rows.find((r) => r.locale === DEFAULT_LOCALE)?.slug ??
    rows[0]?.slug ??
    ""
  );
}

export function getDescendantIds(tree: CategoryTreeItem[], slug: string): string[] {
  function findNode(nodes: CategoryTreeItem[]): CategoryTreeItem | null {
    for (const n of nodes) {
      // Match against ANY locale's slug: department URLs are localized
      // (`/sr/kategorije/moda`), so a default-locale-only match would fail to
      // resolve the dept on every non-default locale.
      if (n.translations.some((tr) => tr.slug === slug)) return n;
      const found = findNode(n.children);
      if (found) return found;
    }
    return null;
  }

  function collectIds(node: CategoryTreeItem): string[] {
    return [node.id, ...node.children.flatMap(collectIds)];
  }

  const node = findNode(tree);
  if (!node) return [];
  return collectIds(node);
}

/**
 * Returns the category-id chain for a slug: the matched node itself followed by
 * each of its ancestors up to the root. Used to resolve which attributes a
 * category page should show as facets (own + inherited from parent departments).
 */
export function getChainIds(tree: CategoryTreeItem[], slug: string): string[] {
  const parentOf = new Map<string, string | null>();
  const nodeBySlug = new Map<string, CategoryTreeItem>();
  const idToNode = new Map<string, CategoryTreeItem>();

  const walk = (node: CategoryTreeItem, parentId: string | null) => {
    parentOf.set(node.id, parentId);
    idToNode.set(node.id, node);
    for (const tr of node.translations) nodeBySlug.set(tr.slug, node);
    for (const child of node.children) walk(child, node.id);
  };
  for (const root of tree) walk(root, null);

  const start = nodeBySlug.get(slug);
  if (!start) return [];

  const chain: string[] = [];
  let current: CategoryTreeItem | undefined = start;
  const guard = new Set<string>();
  while (current && !guard.has(current.id)) {
    guard.add(current.id);
    chain.push(current.id);
    const pid: string | null = parentOf.get(current.id) ?? null;
    current = pid ? idToNode.get(pid) : undefined;
  }
  return chain;
}

export function findCategoryBySlug(
  tree: CategoryTreeItem[],
  slug: string,
): CategoryTreeItem | null {
  for (const node of tree) {
    if (defaultSlug(node.translations) === slug) return node;
    const found = findCategoryBySlug(node.children, slug);
    if (found) return found;
  }
  return null;
}

// ---------- DB queries ----------

export async function getCategoryTree(): Promise<CategoryTreeItem[]> {
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }],
    select: {
      id: true,
      imageUrl: true,
      order: true,
      isActive: true,
      isFeatured: true,
      translations: true,
      parentId: true,
    },
  });

  return buildTree(rows);
}

/**
 * The category tree as a BUYER may browse it: every category that has nothing
 * to buy in it, or under it, is left out.
 *
 * A storefront menu is a promise that there is something at the other end of
 * the link. `getCategoryTree()` above makes no such promise - it is the
 * complete tree, and it stays that way for the admin and seller forms, where
 * an empty category must remain pickable or it could never receive its first
 * product.
 *
 * `keepSlug` keeps the category currently being viewed, even if it is empty:
 * a buyer can arrive at one from a bookmark or a search result, and the
 * department selector on that page has to agree with the URL.
 *
 * CALLERS MUST TAG `CacheTags.products.publicAll()` alongside the category tag
 * when they cache this. What comes back now depends on the catalogue, so
 * publishing the first product in a category is what puts that category back in
 * the menu - and under `cacheLife("max")` nothing else will ever notice.
 */
export async function getStorefrontCategoryTree(
  { keepSlug }: { keepSlug?: string } = {},
): Promise<CategoryTreeItem[]> {
  const { tree, stockedCategoryIds } = await getStorefrontCategoryInputs();
  return pruneEmptyCategories(tree, new Set(stockedCategoryIds), keepSlug);
}

/**
 * The two inputs of the storefront tree, before any pruning: the complete tree
 * and the ids of the categories that have a published product.
 *
 * For a caller whose `keepSlug` comes from the query string. Caching
 * `getStorefrontCategoryTree({ keepSlug })` there keys the cache on whatever a
 * visitor (or a crawler) types into `?dept=` - one permanent entry, and one
 * tree query plus a groupBy, per distinct value. Cache THIS instead, which has
 * no argument, and prune per request with `pruneEmptyCategories`: it is pure
 * and cheap. Same tagging rule as `getStorefrontCategoryTree`.
 *
 * The ids are an array, not a Set, so the result survives `"use cache"`
 * serialization.
 */
export async function getStorefrontCategoryInputs(): Promise<{
  tree: CategoryTreeItem[];
  stockedCategoryIds: string[];
}> {
  const [tree, withProducts] = await Promise.all([
    getCategoryTree(),
    // Grouped rather than counted per category: one pass over the join table,
    // and the result is read as membership, not as a number (see pruneEmpty).
    prisma.productCategory.groupBy({
      by: ["categoryId"],
      where: { product: { status: "PUBLISHED", deletedAt: null } },
    }),
  ]);
  return { tree, stockedCategoryIds: withProducts.map((row) => row.categoryId) };
}

// ---------- Homepage ----------

export type DepartmentWithImages = Omit<CategoryTreeItem, "children"> & {
  productImages: string[];
};

/**
 * Top-level departments with a few product thumbnails each.
 *
 * `featuredOnly` is what separates the two callers: the home page shows the
 * curated handful an admin flagged, the category directory shows every
 * department there is - a directory that silently omitted the unflagged ones
 * would be a worse index than the menu beside it.
 */
export async function getDepartmentsWithImages(
  { featuredOnly }: { featuredOnly: boolean } = { featuredOnly: true },
): Promise<DepartmentWithImages[]> {
  const depts = await prisma.category.findMany({
    where: { isActive: true, parentId: null, ...(featuredOnly && { isFeatured: true }) },
    orderBy: [{ order: "asc" }],
    select: {
      id: true,
      imageUrl: true,
      order: true,
      isActive: true,
      isFeatured: true,
      translations: true,
      children: {
        where: { isActive: true },
        select: {
          id: true,
          children: { where: { isActive: true }, select: { id: true } },
        },
      },
    },
  });

  const built = await Promise.all(
    depts.map(async (dept) => {
      const allCategoryIds = [
        dept.id,
        ...dept.children.map((c) => c.id),
        ...dept.children.flatMap((c) => c.children.map((gc) => gc.id)),
      ];

      const products = await prisma.product.findMany({
        where: {
          status: "PUBLISHED",
          deletedAt: null,
          categories: { some: { categoryId: { in: allCategoryIds } } },
        },
        select: {
          media: {
            take: 1,
            orderBy: { order: "asc" },
            // Department thumb is an image preview - skip videos so the
            // department tile doesn't show a black <video> poster placeholder.
            where: { mediaType: "IMAGE" },
            select: { url: true, thumbUrl: true },
          },
        },
        take: 12,
      });

      const productImages = products
        .flatMap((p) =>
          p.media.map((m: { url: string; thumbUrl: string | null }) =>
            m.thumbUrl ?? m.url,
          ),
        )
        .slice(0, 4);

      // Fall back to the category's own imageUrl when no product images exist
      const images =
        productImages.length > 0
          ? productImages
          : dept.imageUrl
            ? [dept.imageUrl]
            : [];

      // A tile with nothing behind it is the same dead end in the directory
      // as an empty entry is in the menu, so the department is dropped. The
      // query above already answers this - nothing extra is asked of the
      // database. This applies to the FEATURED departments too: flagging a
      // department does not conjure stock into it, and the home page must not
      // lead anywhere emptier than the menu does.
      if (products.length === 0) return null;

      return {
        id: dept.id,
        imageUrl: dept.imageUrl,
        order: dept.order,
        isActive: dept.isActive,
        isFeatured: dept.isFeatured,
        translations: dept.translations,
        productImages: images,
      };
    }),
  );

  return built.filter((dept) => dept !== null);
}

/** The curated departments the home page leads with. */
export function getFeaturedDepartmentsWithImages(): Promise<DepartmentWithImages[]> {
  return getDepartmentsWithImages({ featuredOnly: true });
}

/**
 * One product photo per category, for categories that have no `imageUrl` of
 * their own.
 *
 * WHY RAW SQL. This is "the first image of any published product in each
 * category" - a top-1-per-group, which Prisma cannot express. The alternative
 * is a query per category (the N+1 the department fetcher above already pays
 * for a handful of rows), and the menu needs it for EVERY category in the tree.
 * `DISTINCT ON` answers it in one indexed pass.
 *
 * Ordering is fully deterministic (`order`, then media id, then product id), so
 * the same category keeps the same thumbnail between requests rather than
 * flickering between two equally-ranked photos. No JS value is bound into the
 * statement - nothing here is a date, which is the one thing that would make a
 * raw query a timezone problem (see the note in CLAUDE.md).
 */
export async function getCategoryImageFallbacks(): Promise<Record<string, string>> {
  const rows = await prisma.$queryRaw<
    { categoryId: string; url: string; thumbUrl: string | null }[]
  >`
    SELECT DISTINCT ON (pc."categoryId")
           pc."categoryId" AS "categoryId",
           m."url"         AS "url",
           m."thumbUrl"    AS "thumbUrl"
    FROM "ProductCategory" pc
    JOIN "Product" p
      ON p.id = pc."productId"
     AND p.status = 'PUBLISHED'
     AND p."deletedAt" IS NULL
    JOIN "ProductMedia" m
      ON m."productId" = p.id
     AND m."mediaType" = 'IMAGE'
    ORDER BY pc."categoryId", m."order" ASC, m.id ASC, p.id ASC
  `;

  const out: Record<string, string> = {};
  // The thumbnail where one exists - these render at ~140px, so shipping the
  // full-size original would be the page's heaviest download for its smallest
  // picture.
  for (const row of rows) out[row.categoryId] = row.thumbUrl ?? row.url;
  return out;
}

// ---------- Admin CRUD ----------

export type CategoryListItem = {
  id: string;
  imageUrl: string | null;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
  translations: CategoryTranslationRow[];
  parentId: string | null;
  parent: { id: string; translations: CategoryTranslationRow[] } | null;
  _count: { children: number; products: number };
};

export async function getAllCategoriesFlat(): Promise<CategoryListItem[]> {
  const rows = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { order: "asc" }],
    select: {
      id: true,
      imageUrl: true,
      order: true,
      isActive: true,
      isFeatured: true,
      translations: true,
      parentId: true,
      parent: { select: { id: true, translations: true } },
      _count: { select: { children: true, products: true } },
    },
  });

  return rows;
}

export async function getCategoryById(id: string) {
  return prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      imageUrl: true,
      order: true,
      isActive: true,
      isFeatured: true,
      translations: true,
      parentId: true,
      attributes: {
        orderBy: { order: "asc" },
        select: { attributeId: true, order: true, isFilterable: true },
      },
    },
  });
}

/**
 * Maps every category id to the ids of the attributes assigned *directly* to
 * it. The category form uses this to compute the inherited attribute set for a
 * chosen parent (a department's attributes apply to all descendants).
 */
export async function getCategoryAttributeMap(): Promise<
  Record<string, string[]>
> {
  const rows = await prisma.categoryAttribute.findMany({
    orderBy: { order: "asc" },
    select: { categoryId: true, attributeId: true },
  });
  const map: Record<string, string[]> = {};
  for (const r of rows) (map[r.categoryId] ??= []).push(r.attributeId);
  return map;
}

type CategoryAttributeAssignment = {
  attributeId: string;
  order: number;
  isFilterable: boolean;
};

type CategoryMutationData = {
  name: string;
  slug?: string;
  parentId?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  translations?: CategoryTranslations | null;
  order?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  attributes?: CategoryAttributeAssignment[];
};

function buildCategoryTranslationRows(
  data: CategoryMutationData,
  suffix?: string,
): CategoryTranslationRow[] {
  const defaultSlug = (
    (data.slug?.trim() || slugify(data.name)) + (suffix ? `-${suffix}` : "")
  ).trim();
  const rows: CategoryTranslationRow[] = [
    {
      locale: DEFAULT_LOCALE,
      name: data.name.trim(),
      slug: defaultSlug,
      description: data.description?.trim() || null,
    },
  ];

  for (const locale of NON_DEFAULT_LOCALES) {
    const t = data.translations?.[locale];
    const name = t?.name?.trim();
    const explicitSlug = t?.slug?.trim();
    const description = t?.description?.trim();
    // Nothing entered anywhere for this locale - genuinely nothing to save.
    if (!name && !explicitSlug && !description) continue;
    // `slug` is `@@unique([locale, slug])` - it can never be blank (two
    // categories both left with an empty slug would collide), so it still
    // needs a real, derived fallback even when name is blank. `name` has no
    // such constraint, so it's stored exactly as typed (possibly blank);
    // `getCategoryName` falls back to the default locale's name at DISPLAY
    // time instead, so the storefront never shows a blank name but the
    // admin form still shows this locale's name as genuinely empty - not
    // silently refilled with the English name - when they clear it.
    const effectiveName = name || data.name.trim();
    // The uniqueness suffix has to reach EVERY locale, not just the default
    // one: `@@unique([locale, slug])` is enforced per row, so a retry that only
    // suffixed the default row still collided on the translated ones.
    const derivedSlug = explicitSlug || slugify(effectiveName);
    rows.push({
      locale,
      name: name ?? "",
      slug: derivedSlug
        ? derivedSlug + (suffix ? `-${suffix}` : "")
        : `${defaultSlug}-${locale}`,
      description: description || null,
    });
  }
  return rows;
}

export async function createCategory(data: CategoryMutationData) {
  const category = await createWithUniqueSlugRetry(async (suffix) => {
    const rows = buildCategoryTranslationRows(data, suffix);

    return prisma.$transaction(async (tx) => {
      const created = await tx.category.create({
        data: {
          parentId: data.parentId || null,
          imageUrl: data.imageUrl || null,
          order: data.order ?? 0,
          isActive: data.isActive ?? true,
          isFeatured: data.isFeatured ?? false,
          translations: { create: rows },
          attributes: {
            create: (data.attributes ?? []).map((a) => ({
              attributeId: a.attributeId,
              order: a.order,
              isFilterable: a.isFilterable,
            })),
          },
        },
        include: { translations: true },
      });
      // Reclaim these slugs from history so a live category URL never 308s away.
      await recordSlugChanges(
        tx,
        "CATEGORY",
        created.id,
        new Map(),
        new Map(rows.map((r) => [r.locale, r.slug])),
      );
      return created;
    });
  });

  revalidateCategoryCache(category.id);
  return category;
}

export async function updateCategory(id: string, data: CategoryMutationData) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { translations: true },
  });
  if (!existing) throw new NotFoundError(`Category ${id} not found`);

  const rows = buildCategoryTranslationRows(data);

  const oldByLocale = new Map(existing.translations.map((t) => [t.locale, t.name]));
  const searchableChanged = rows.some((r) => oldByLocale.get(r.locale) !== r.name);

  const category = await prisma.$transaction(async (tx) => {
    await tx.category.update({
      where: { id },
      data: {
        parentId: data.parentId ?? null,
        imageUrl: data.imageUrl || null,
        order: data.order ?? 0,
        isActive: data.isActive ?? true,
        isFeatured: data.isFeatured ?? false,
      },
    });

    await tx.categoryTranslation.deleteMany({ where: { categoryId: id } });
    await tx.categoryTranslation.createMany({
      data: rows.map((r) => ({ ...r, categoryId: id })),
    });

    // Replace-all the attribute assignments. CategoryAttribute has no FK
    // fan-out (product values reference Attribute, not the assignment), so
    // wiping and recreating is safe and simpler than a per-row diff.
    await tx.categoryAttribute.deleteMany({ where: { categoryId: id } });
    if (data.attributes?.length) {
      await tx.categoryAttribute.createMany({
        data: data.attributes.map((a) => ({
          categoryId: id,
          attributeId: a.attributeId,
          order: a.order,
          isFilterable: a.isFilterable,
        })),
      });
    }

    await recordSlugChanges(
      tx,
      "CATEGORY",
      id,
      new Map(existing.translations.map((t) => [t.locale, t.slug])),
      new Map(rows.map((r) => [r.locale, r.slug])),
    );

    return tx.category.findUniqueOrThrow({
      where: { id },
      include: { translations: true },
    });
  });

  if (searchableChanged) {
    const productCategories = await prisma.productCategory.findMany({
      where: { categoryId: id, product: { deletedAt: null } },
      select: { productId: true },
    });
    for (const pc of productCategories) {
      await refreshProductSearchText(prisma, pc.productId);
    }
  }

  revalidateCategoryCache(category.id);
  return category;
}

/** Returns the deleted category's default-locale name, for the audit trail. */
export async function deleteCategory(id: string): Promise<string> {
  const existing = await prisma.category.findUnique({
    where: { id },
    select: {
      translations: { select: { locale: true, name: true } },
      _count: { select: { children: true, products: true } },
    },
  });
  if (!existing) throw new NotFoundError(`Category ${id} not found`);

  // Subcategories first: they are the blocker that looks like data loss. The
  // delete itself would succeed - `Category.parent` has no `onDelete`, so the
  // children are re-parented to the root rather than removed - and the admin
  // reads that as "it deleted my subcategories". See assertNotInUse.
  assertNotInUse([
    { count: existing._count.children, key: "categoryHasChildren" },
    { count: existing._count.products, key: "categoryHasProducts" },
  ]);

  await prisma.category.delete({ where: { id } });
  revalidateCategoryCache(id);
  return sourceLabelOf(existing.translations);
}

/** The source's default-locale name, for the audit trail's "Copied from". */
function sourceLabelOf(
  translations: readonly { locale: string; name: string }[],
): string {
  return translations.find((t) => t.locale === DEFAULT_LOCALE)?.name ?? "";
}

export async function duplicateCategory(id: string) {
  const source = await prisma.category.findUnique({
    where: { id },
    include: {
      translations: true,
      attributes: { select: { attributeId: true, order: true, isFilterable: true } },
    },
  });
  if (!source) throw new NotFoundError(`Category ${id} not found`);

  // Suffix every slug so the copy can never collide with the source on the
  // unique CategoryTranslation.slug constraint. Prefix EVERY locale's name
  // with its localized "Copy of" (copyName) - the admin list displays the
  // viewer-locale name, so a prefix only on the default locale left e.g. the
  // sr list showing a row identical to the source.
  const now = Date.now();
  const rows: CategoryTranslationRow[] = source.translations.map((t) => ({
    locale: t.locale,
    name: copyName(t.locale, t.name, CATEGORY_NAME_MAX_LENGTH),
    slug: copyIdentifier(t.slug, CATEGORY_SLUG_MAX_LENGTH, now),
    description: t.description,
  }));

  const category = await prisma.$transaction(async (tx) => {
    const created = await tx.category.create({
      data: {
        parentId: source.parentId,
        imageUrl: source.imageUrl,
        order: source.order,
        isActive: source.isActive,
        // A featured copy would surface a half-edited duplicate on the
        // homepage, so the copy always starts un-featured.
        isFeatured: false,
        translations: { create: rows },
        attributes: {
          create: source.attributes.map((a) => ({
            attributeId: a.attributeId,
            order: a.order,
            isFilterable: a.isFilterable,
          })),
        },
      },
      include: { translations: true },
    });
    // Reclaim the copy's slugs from history so its URL never 308s away.
    await recordSlugChanges(
      tx,
      "CATEGORY",
      created.id,
      new Map(),
      new Map(rows.map((r) => [r.locale, r.slug])),
    );
    return created;
  });

  revalidateCategoryCache(category.id);
  // `sourceLabel` is the source's default-locale name: the audit trail then
  // reads "Copied from: Obuca" instead of a UUID no reader can resolve.
  return { ...category, sourceLabel: sourceLabelOf(source.translations) };
}
