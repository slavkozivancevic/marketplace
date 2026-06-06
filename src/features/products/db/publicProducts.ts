import { prisma } from "@/core/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { SerializedProductListItem } from "@/types/types";
import type { AttributeFilter } from "@/lib/query/attrs";

type SortField = "createdAt" | "price" | "avgRating";
type SortOrder = "asc" | "desc";

export type PublicProductWhereParams = {
  search?: string;
  searchLocale?: string;
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean | null;
  isDigital?: boolean | null;
  brandId?: string[];
  minRating?: number | null;
  categoryId?: string[];
  attributeFilters?: AttributeFilter[];
};

/** Builds the Prisma where clause for a single attribute facet selection. */
function attributeClause(f: AttributeFilter): Prisma.ProductWhereInput | null {
  if (f.kind === "option") {
    if (!f.values.length) return null;
    return {
      attributeValues: {
        some: { attribute: { key: f.key }, option: { value: { in: f.values } } },
      },
    };
  }
  if (f.kind === "range") {
    if (f.min == null && f.max == null) return null;
    const num: Prisma.FloatFilter = {};
    if (f.min != null) num.gte = f.min;
    if (f.max != null) num.lte = f.max;
    return {
      attributeValues: { some: { attribute: { key: f.key }, valueNumeric: num } },
    };
  }
  // boolean
  return {
    attributeValues: { some: { attribute: { key: f.key }, valueBool: true } },
  };
}

/**
 * Shared `where` builder for the public catalog - reused by the product list
 * query and the facet count aggregation so both stay perfectly in sync.
 * Attribute facets combine with AND across attributes (each must match at least
 * one value); option values within one attribute are OR (handled by `in`).
 */
export function buildPublicProductWhere(
  p: PublicProductWhereParams,
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
    deletedAt: null,
  };

  if (p.search) {
    const localeClause = p.searchLocale ? { locale: p.searchLocale } : {};
    where.translations = {
      some: { ...localeClause, searchText: { contains: p.search, mode: "insensitive" } },
    };
  }

  if (p.minPrice != null || p.maxPrice != null) {
    where.price = {};
    if (p.minPrice != null) where.price.gte = p.minPrice;
    if (p.maxPrice != null) where.price.lte = p.maxPrice;
  }

  if (p.onSale === true) where.compareAtPrice = { not: null };
  if (p.isDigital != null) where.isDigital = p.isDigital;
  if (p.brandId?.length) where.brandId = { in: p.brandId };
  if (p.minRating != null && p.minRating > 0) where.avgRating = { gte: p.minRating };
  if (p.categoryId?.length) {
    where.categories = { some: { categoryId: { in: p.categoryId } } };
  }

  const attrClauses = (p.attributeFilters ?? [])
    .map(attributeClause)
    .filter((c): c is Prisma.ProductWhereInput => c !== null);
  if (attrClauses.length) where.AND = attrClauses;

  return where;
}

/**
 * Cross-tenant public product feed (status PUBLISHED, not deleted).
 *
 * Cursor-paginated using the `take + 1` trick. Numbers are serialized to
 * primitive numbers for safe transport across the SSR/client boundary.
 *
 * Search runs against `ProductTranslation.searchText` per locale - callers
 * pass the buyer's active locale so matches stay relevant to the UI language.
 */
export async function getPublicProductsPage({
  take,
  cursor,
  search,
  searchLocale,
  sortBy = "createdAt",
  sortOrder = "desc",
  minPrice,
  maxPrice,
  onSale,
  isDigital,
  brandId,
  minRating,
  categoryId,
  attributeFilters,
}: {
  take: number;
  cursor?: string;
  search?: string;
  searchLocale?: string;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean | null;
  isDigital?: boolean | null;
  brandId?: string[];
  minRating?: number | null;
  categoryId?: string[];
  attributeFilters?: AttributeFilter[];
}): Promise<{ items: SerializedProductListItem[]; nextCursor?: string }> {
  const where = buildPublicProductWhere({
    search,
    searchLocale,
    minPrice,
    maxPrice,
    onSale,
    isDigital,
    brandId,
    minRating,
    categoryId,
    attributeFilters,
  });

  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
    { [sortBy]: sortOrder },
    { id: "asc" },
  ];

  const rows = await prisma.product.findMany({
    where,
    orderBy,
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    include: {
      translations: true,
      media: { orderBy: { order: "asc" }, take: 5 },
      brand: { select: { id: true, logoUrl: true, translations: true } },
    },
  });

  let nextCursor: string | undefined;
  if (rows.length > take) {
    const next = rows.pop();
    nextCursor = next?.id;
  }

  const items: SerializedProductListItem[] = rows.map((p) => ({
    ...p,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    costPrice: p.costPrice,
  }));

  return { items, nextCursor };
}
