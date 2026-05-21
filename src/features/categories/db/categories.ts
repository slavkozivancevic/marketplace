import { prisma } from "@/core/db/prisma";
import { NotFoundError } from "@/features/common/errors/domainErrors";
import { revalidateCategoryCache } from "./cache";
import { slugify } from "@/lib/utils";
import { refreshProductSearchText } from "@/features/products/db/products";

// ---------- Translation types & helpers ----------

export type { CategoryTranslations } from "../utils/translations";
export { getCategoryName, getCategoryDescription } from "../utils/translations";
import type { CategoryTranslations } from "../utils/translations";

// ---------- Tree types ----------

export type CategoryTreeItem = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
  translations: CategoryTranslations | null;
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

export function getDescendantIds(tree: CategoryTreeItem[], slug: string): string[] {
  function findNode(nodes: CategoryTreeItem[]): CategoryTreeItem | null {
    for (const n of nodes) {
      if (n.slug === slug) return n;
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

export function findCategoryBySlug(
  tree: CategoryTreeItem[],
  slug: string,
): CategoryTreeItem | null {
  for (const node of tree) {
    if (node.slug === slug) return node;
    const found = findCategoryBySlug(node.children, slug);
    if (found) return found;
  }
  return null;
}

// ---------- DB queries ----------

export async function getCategoryTree(): Promise<CategoryTreeItem[]> {
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      order: true,
      isActive: true,
      isFeatured: true,
      translations: true,
      parentId: true,
    },
  });

  return buildTree(
    rows.map((r) => ({
      ...r,
      translations: (r.translations ?? null) as CategoryTranslations | null,
    })),
  );
}

// ---------- Homepage ----------

export type DepartmentWithImages = Omit<CategoryTreeItem, "children"> & {
  productImages: string[];
};

export async function getFeaturedDepartmentsWithImages(): Promise<DepartmentWithImages[]> {
  const depts = await prisma.category.findMany({
    where: { isActive: true, isFeatured: true, parentId: null },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
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
            // Department thumb is an image preview — skip videos so the
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
        name: dept.name,
        slug: dept.slug,
        imageUrl: dept.imageUrl,
        order: dept.order,
        isActive: dept.isActive,
        isFeatured: dept.isFeatured,
        translations: (dept.translations ?? null) as CategoryTranslations | null,
        productImages: images,
      };
    }),
  );
}

// ---------- Admin CRUD ----------

export type CategoryListItem = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  order: number;
  isActive: boolean;
  isFeatured: boolean;
  translations: CategoryTranslations | null;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  _count: { children: number; products: number };
};

export async function getAllCategoriesFlat(): Promise<CategoryListItem[]> {
  const rows = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { order: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      order: true,
      isActive: true,
      isFeatured: true,
      translations: true,
      parentId: true,
      parent: { select: { id: true, name: true } },
      _count: { select: { children: true, products: true } },
    },
  });

  return rows.map((r) => ({
    ...r,
    translations: (r.translations ?? null) as CategoryTranslations | null,
  }));
}

export async function getCategoryById(id: string) {
  const row = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      order: true,
      isActive: true,
      isFeatured: true,
      translations: true,
      parentId: true,
    },
  });
  if (!row) return null;
  return {
    ...row,
    translations: (row.translations ?? null) as CategoryTranslations | null,
  };
}

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
};

export async function createCategory(data: CategoryMutationData) {
  const slug = data.slug?.trim() || slugify(data.name);

  const category = await prisma.category.create({
    data: {
      name: data.name.trim(),
      slug,
      parentId: data.parentId || null,
      imageUrl: data.imageUrl || null,
      description: data.description || null,
      translations: data.translations ?? undefined,
      order: data.order ?? 0,
      isActive: data.isActive ?? true,
      isFeatured: data.isFeatured ?? false,
    },
  });

  revalidateCategoryCache(category.id);
  return category;
}

export async function updateCategory(id: string, data: CategoryMutationData) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Category ${id} not found`);

  const slug = data.slug?.trim() || slugify(data.name);

  const newName = data.name.trim();
  const newSrName =
    (data.translations as CategoryTranslations | null | undefined)?.sr?.name?.trim() ?? "";
  const existingSrName =
    (existing.translations as CategoryTranslations | null)?.sr?.name?.trim() ?? "";

  const searchableChanged =
    newName !== existing.name || newSrName !== existingSrName;

  const category = await prisma.category.update({
    where: { id },
    data: {
      name: newName,
      slug,
      parentId: data.parentId ?? null,
      imageUrl: data.imageUrl || null,
      description: data.description || null,
      translations: data.translations ?? undefined,
      order: data.order ?? 0,
      isActive: data.isActive ?? true,
      isFeatured: data.isFeatured ?? false,
    },
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

export async function deleteCategory(id: string) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Category ${id} not found`);

  await prisma.category.delete({ where: { id } });
  revalidateCategoryCache(id);
}