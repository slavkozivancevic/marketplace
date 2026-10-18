import { cacheTag } from "next/cache";
import { parseMoney, serializeMoneyFields } from "@/lib/money";
import { CacheTags } from "@/lib/cache/tags";
import { prisma } from "@/core/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { SerializedProductListItem } from "@/types/types";
import { cardAvailability } from "../utils/availability";
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
  // The selling org's delivery terms. Joined here rather than looked up per
  // card, so the grid, the wishlist and every carousel can say "free delivery"
  // without a second query - and all of them say it from the same row.
  organization: {
    select: {
      shippingFlatRate: true,
      shippingFreeThresholdMoney: true,
      leadTimeMinDays: true,
      leadTimeMaxDays: true,
    },
  },
  // Availability, as two cheap probes rather than every variant row: whether
  // the product has variants at all, and whether ANY of them still has stock.
  // `Product.stock` is null for a variant product, so without these a card
  // could not tell "nobody tracks this" from "every variant is sold out".
  _count: { select: { variants: true } },
  variants: { where: { stock: { gt: 0 } }, take: 1, select: { id: true } },
} satisfies Prisma.ProductInclude;

type ListItemRow = Prisma.ProductGetPayload<{ include: typeof listItemInclude }>;

/**
 * Tags a `"use cache"` reader with every seller whose cards it returns.
 *
 * A card built from `listItemInclude` carries its seller's delivery terms (the
 * "free delivery" pill, the lead time), and those change when the SELLER saves
 * new terms - an org write that touches no product tag. A cached reader tagged
 * only with product tags therefore kept advertising free delivery for a seller
 * who had started charging, until some unrelated product edit happened to drop
 * it. Every cached reader of cards calls this, so an org write reaches them all.
 * Call it only inside a `"use cache"` scope.
 */
export function tagSellerTerms(rows: readonly { organizationId: string }[]) {
  for (const orgId of new Set(rows.map((r) => r.organizationId))) {
    cacheTag(CacheTags.organizations.byId(orgId));
  }
}

/**
 * Projects a raw card row's money columns into the display set + USD mirror,
 * and the seller's delivery terms into the compact shape a card renders from.
 *
 * `organization` is replaced rather than passed through: a card needs to know
 * "is delivery free, and from what amount", not the seller's settings row. The
 * threshold keeps its MoneySet because the card prints that amount, and money
 * is never rendered by converting the USD mirror.
 */
export function serializeListItem(p: ListItemRow): SerializedProductListItem {
  const { organization, _count, variants, ...rest } = p;
  return {
    ...rest,
    ...serializeMoneyFields(p),
    // Resolved here, once, so every card surface (grid, wishlist, carousels)
    // answers the same way - and so the probes above never leak into the
    // payload as something a component might re-derive differently.
    availability: cardAvailability({
      stock: p.stock,
      variantCount: _count.variants,
      hasVariantInStock: variants.length > 0,
    }),
    sellerShipping: {
      // Free for everyone, with no minimum to reach - the only claim a card can
      // make without qualifying it.
      freeAlways: organization.shippingFlatRate === 0,
      freeThresholdMoney: parseMoney(organization.shippingFreeThresholdMoney),
      leadTimeMinDays: organization.leadTimeMinDays,
      leadTimeMaxDays: organization.leadTimeMaxDays,
    },
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

  // "On sale" has to mean what the card draws: a struck-through price and a
  // percentage, which ProductCard renders only when `compareAtPrice > price`.
  // Merely HAVING an old price is not a discount - an old price that is lower
  // than today's is a price rise someone forgot to clear, and filtering on
  // `not: null` put such a product in the sale listing with no discount on it.
  // The field reference keeps the comparison in SQL.
  if (p.onSale === true) where.compareAtPrice = { gt: prisma.product.fields.price };
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
