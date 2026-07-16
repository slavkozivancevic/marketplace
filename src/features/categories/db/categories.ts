import { prisma } from "@/core/db/prisma";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { revalidateCategoryCache } from "./cache";
import { slugify } from "@/lib/utils";
import { copyName } from "@/lib/i18n/copyName";
import { refreshProductSearchText } from "@/features/products/db/products";
import { recordSlugChanges } from "@/lib/seo/slugHistory";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from "@/i18n/config";
import { Prisma } from "@/generated/prisma/client";

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

// ---------- Homepage ----------

export type DepartmentWithImages = Omit<CategoryTreeItem, "children"> & {
  productImages: string[];
};

export async function getFeaturedDepartmentsWithImages(): Promise<DepartmentWithImages[]> {
  const depts = await prisma.category.findMany({
    where: { isActive: true, isFeatured: true, parentId: null },
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

  return Promise.all(
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
): CategoryTranslationRow[] {
  const defaultSlug = (data.slug?.trim() || slugify(data.name)).trim();
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
    if (!name) continue;
    const explicitSlug = t?.slug?.trim();
    rows.push({
      locale,
      name,
      slug: explicitSlug || slugify(name) || `${defaultSlug}-${locale}`,
      description: t?.description?.trim() || null,
    });
  }
  return rows;
}

export async function createCategory(data: CategoryMutationData) {
  const rows = buildCategoryTranslationRows(data);

  const category = await prisma.$transaction(async (tx) => {
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
      await refreshProductSearchText(prisma as unknown as Prisma.TransactionClient, pc.productId);
    }
  }

  revalidateCategoryCache(category.id);
  return category;
}

export async function deleteCategory(id: string) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Category ${id} not found`);

  await prisma.category.delete({ where: { id } });
  revalidateCategoryCache(id);
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
  const suffix = Date.now().toString(36);
  const rows: CategoryTranslationRow[] = source.translations.map((t) => ({
    locale: t.locale,
    name: copyName(t.locale, t.name),
    slug: `${t.slug}-copy-${suffix}`,
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
  return category;
}
