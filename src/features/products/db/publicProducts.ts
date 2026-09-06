import { prisma } from "@/core/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { SerializedProductListItem } from "@/types/types";
import type { AttributeFilter } from "@/lib/query/attrs";
import { DEFAULT_LOCALE } from "@/i18n/config";

type SortField = "createdAt" | "price" | "avgRating";
type SortOrder = "asc" | "desc";

/**
 * Canonical Prisma `include` for a storefront product *card* - the exact
 * relation shape `SerializedProductListItem` (and the shared `<ProductCard>`)
 * needs. Callers spread this and override `media` to set their own `take`
 * (grid wants several frames for the hover cycler; carousels want one still).
 * Keeping a single source here means the grid, wishlist, related/frequently-
 * bought and recently-viewed strips never drift in what they fetch.
 */
export const listItemInclude = {
  translations: true,
  // `id` is a deterministic tiebreaker so equal `order` values never sort
  // unstably across queries (which flickers the video pill in/out of the
  // `take`-limited media window).
  media: { orderBy: [{ order: "asc" }, { id: "asc" }] },
  brand: {
    select: {
      id: true,
      logoUrl: true,
      logoUrlDark: true,
      logoBackdrop: true,
      logoBackdropDark: true,
      translations: true,
    },
  },
} satisfies Prisma.ProductInclude;

type ListItemRow = Prisma.ProductGetPayload<{ include: typeof listItemInclude }>;

/** Serializes a raw card row's Decimal money fields to plain numbers. */
export function serializeListItem(p: ListItemRow): SerializedProductListItem {
  return {
    ...p,
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
    costPrice: p.costPrice != null ? Number(p.costPrice) : null,
  };
}

export type PublicProductWhereParams = {
  search?: string;
  searchLocale?: string;
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean | null;
  bestseller?: boolean | null;
  isDigital?: boolean | null;
  minWarranty?: number | null;
  origin?: string[];
  brandId?: string[];
  minRating?: number | null;
  categoryId?: string[];
  tagId?: string[];
  attributeFilters?: AttributeFilter[];
};

/** Builds the Prisma where clause for a single attribute facet selection. */
function attributeClause(f: AttributeFilter): Prisma.ProductWhereInput | null {
  if (f.kind === "option") {
    if (!f.values.length) return null;
    // Match either a product-level value (non-variant attribute) OR a variant
    // axis value (variant-defining attribute) - the unified model stores the
    // two in different places, so a facet selection checks both.
    return {
      OR: [
        {
          attributeValues: {
            some: { attribute: { key: f.key }, option: { value: { in: f.values } } },
          },
        },
        {
          variants: {
            some: {
              attributeValues: {
                some: { attribute: { key: f.key }, option: { value: { in: f.values } } },
              },
            },
          },
        },
      ],
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
 * Locale-with-fallback name match against a `{ translations: { locale, name }[] }`
 * relation (currently just Tag) - mirrors the `pick()` fallback used when
 * building `ProductTranslation.searchText`: match the requested locale's own
 * name, or - only when that locale has no translation row at all for this
 * entity - its default-locale name instead.
 */
function translationNameMatch(search: string, locale: string): Prisma.TagWhereInput {
  return {
    OR: [
      { translations: { some: { locale, name: { contains: search, mode: "insensitive" } } } },
      {
        AND: [
          { translations: { none: { locale } } },
          {
            translations: {
              some: { locale: DEFAULT_LOCALE, name: { contains: search, mode: "insensitive" } },
            },
          },
        ],
      },
    ],
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
    if (p.searchLocale) {
      // Match the requested locale's own searchText, OR - for a product with
      // no translation row at all in that locale - fall back to the default
      // locale's searchText. Mirrors how the storefront already displays such
      // products (title/description fall back to the default locale), so a
      // product that's findable/visible in a locale by browsing shouldn't be
      // unfindable by search just because it was never translated.
      where.OR = [
        {
          translations: {
            some: { locale: p.searchLocale, searchText: { contains: p.search, mode: "insensitive" } },
          },
        },
        {
          AND: [
            { translations: { none: { locale: p.searchLocale } } },
            {
              translations: {
                some: { locale: DEFAULT_LOCALE, searchText: { contains: p.search, mode: "insensitive" } },
              },
            },
          ],
        },
        // A tag's own name is independently translated from the product it's
        // attached to - a product should be findable by a tag's localized
        // name even when the PRODUCT itself was never translated into that
        // locale (searchText above can only reflect a tag name once baked
        // into an existing product translation row). Tag/TagTranslation is a
        // tiny table, so this join costs nothing like a product-text scan
        // would.
        { tags: { some: { tag: translationNameMatch(p.search, p.searchLocale) } } },
      ];
    } else {
      where.translations = {
        some: { searchText: { contains: p.search, mode: "insensitive" } },
      };
    }
  }

  if (p.minPrice != null || p.maxPrice != null) {
    where.price = {};
    if (p.minPrice != null) where.price.gte = p.minPrice;
    if (p.maxPrice != null) where.price.lte = p.maxPrice;
  }

  if (p.onSale === true) where.compareAtPrice = { not: null };
  if (p.bestseller === true) where.isBestseller = true;
  if (p.isDigital != null) where.isDigital = p.isDigital;
  // "At least N months" - products with no warranty recorded are excluded
  // rather than treated as zero, since null means unknown, not none.
  if (p.minWarranty != null && p.minWarranty > 0) {
    where.warrantyMonths = { gte: p.minWarranty };
  }
  if (p.origin?.length) where.countryOfOrigin = { in: p.origin };
  if (p.brandId?.length) where.brandId = { in: p.brandId };
  if (p.minRating != null && p.minRating > 0) where.avgRating = { gte: p.minRating };
  if (p.categoryId?.length) {
    where.categories = { some: { categoryId: { in: p.categoryId } } };
  }
  if (p.tagId?.length) {
    where.tags = { some: { tagId: { in: p.tagId } } };
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
  bestseller,
  isDigital,
  minWarranty,
  origin,
  brandId,
  minRating,
  categoryId,
  tagId,
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
  bestseller?: boolean | null;
  isDigital?: boolean | null;
  minWarranty?: number | null;
  origin?: string[];
  brandId?: string[];
  minRating?: number | null;
  categoryId?: string[];
  tagId?: string[];
  attributeFilters?: AttributeFilter[];
}): Promise<{ items: SerializedProductListItem[]; nextCursor?: string }> {
  const where = buildPublicProductWhere({
    search,
    searchLocale,
    minPrice,
    maxPrice,
    onSale,
    bestseller,
    isDigital,
    minWarranty,
    origin,
    brandId,
    minRating,
    categoryId,
    tagId,
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
    include: { ...listItemInclude, media: { orderBy: [{ order: "asc" }, { id: "asc" }], take: 5 } },
  });

  let nextCursor: string | undefined;
  if (rows.length > take) {
    const next = rows.pop();
    nextCursor = next?.id;
  }

  const items: SerializedProductListItem[] = rows.map(serializeListItem);

  return { items, nextCursor };
}
