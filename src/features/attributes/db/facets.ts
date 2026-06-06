import { prisma } from "@/core/db/prisma";
import type { AttributeType } from "@/generated/prisma/client";
import {
  buildPublicProductWhere,
  type PublicProductWhereParams,
} from "@/features/products/db/publicProducts";
import type { AttributeFilter } from "@/lib/query/attrs";

type LabelRow = { locale: string; label: string };

type FacetOptionDef = { id: string; value: string; translations: LabelRow[] };
type FacetAttributeDef = {
  key: string;
  type: AttributeType;
  unit: string | null;
  translations: LabelRow[];
  options: FacetOptionDef[];
};

export type FacetOption = { value: string; translations: LabelRow[]; count: number };

export type Facet = {
  key: string;
  type: AttributeType;
  unit: string | null;
  translations: LabelRow[];
  /** Populated for SELECT / MULTI_SELECT. */
  options: FacetOption[];
  /** Populated for BOOLEAN - products matching `true`. */
  trueCount?: number;
  /** Populated for RANGE - available numeric bounds in the current result set. */
  bounds?: { min: number | null; max: number | null };
};

/**
 * Full facet payload for a catalog page: the category-specific attribute
 * facets plus disjunctive counts for the always-present base refinements
 * (brand, on-sale toggle, product type). All counts are computed for the
 * current result set, each ignoring its own selection so the refinement stays
 * countable while the buyer narrows within it (Amazon-style multi-select).
 */
export type CategoryFacetsResult = {
  facets: Facet[];
  brandCounts: Record<string, number>;
  onSaleCount: number;
  isDigitalCounts: { true: number; false: number };
};

/**
 * Resolves the filterable attribute definitions for a category chain (the
 * category plus its ancestors), deduped by attribute and ordered by their
 * assignment order. These drive which facets a category page renders.
 */
async function getFacetAttributes(
  chainIds: string[],
): Promise<FacetAttributeDef[]> {
  if (chainIds.length === 0) return [];

  const assignments = await prisma.categoryAttribute.findMany({
    where: { categoryId: { in: chainIds }, isFilterable: true },
    orderBy: { order: "asc" },
    select: {
      order: true,
      attribute: {
        select: {
          key: true,
          type: true,
          unit: true,
          order: true,
          translations: { select: { locale: true, label: true } },
          options: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              value: true,
              translations: { select: { locale: true, label: true } },
            },
          },
        },
      },
    },
  });

  // Dedupe by attribute key (an attribute may be assigned at multiple levels).
  const seen = new Set<string>();
  const defs: (FacetAttributeDef & { sort: number })[] = [];
  for (const a of assignments) {
    if (seen.has(a.attribute.key)) continue;
    seen.add(a.attribute.key);
    defs.push({
      key: a.attribute.key,
      type: a.attribute.type,
      unit: a.attribute.unit,
      translations: a.attribute.translations,
      options: a.attribute.options,
      sort: a.attribute.order,
    });
  }
  defs.sort((x, y) => x.sort - y.sort);
  return defs.map((d) => ({
    key: d.key,
    type: d.type,
    unit: d.unit,
    translations: d.translations,
    options: d.options,
  }));
}

/**
 * Computes the facets (with per-value counts) for a category page.
 *
 * Amazon-style multi-select semantics: each facet's counts are computed with
 * every OTHER active attribute filter applied, but ignoring its own selection -
 * so refining within one facet keeps its sibling options countable.
 */
export async function getCategoryFacets(params: {
  /** Descendant category ids used to scope which products are counted. */
  deptDescendantIds: string[];
  /** Category chain (self + ancestors) used to resolve which facets to show. */
  chainIds: string[];
  /** Non-attribute base filters currently applied (price, rating, brand...). */
  base: Omit<PublicProductWhereParams, "categoryId" | "attributeFilters">;
  /** Currently selected attribute filters. */
  attributeFilters: AttributeFilter[];
}): Promise<CategoryFacetsResult> {
  const defs = await getFacetAttributes(params.chainIds);

  const facetResults = await Promise.all(
    defs.map(async (def): Promise<Facet | null> => {
      // Apply all attribute filters except this facet's own selection.
      const otherFilters = params.attributeFilters.filter((f) => f.key !== def.key);
      const where = buildPublicProductWhere({
        ...params.base,
        categoryId: params.deptDescendantIds,
        attributeFilters: otherFilters,
      });

      if (def.type === "SELECT" || def.type === "MULTI_SELECT") {
        const grouped = await prisma.productAttributeValue.groupBy({
          by: ["optionId"],
          where: { attribute: { key: def.key }, optionId: { not: null }, product: where },
          _count: { _all: true },
        });
        const countByOptionId = new Map(
          grouped.map((g) => [g.optionId, g._count._all]),
        );
        const ownFilter = params.attributeFilters.find(
          (f) => f.key === def.key && f.kind === "option",
        );
        const selected = new Set(
          ownFilter && ownFilter.kind === "option" ? ownFilter.values : [],
        );
        const options: FacetOption[] = def.options
          .map((o) => ({
            value: o.value,
            translations: o.translations,
            count: countByOptionId.get(o.id) ?? 0,
          }))
          .filter((o) => o.count > 0 || selected.has(o.value));
        if (options.length === 0) return null;
        return { key: def.key, type: def.type, unit: def.unit, translations: def.translations, options };
      }

      if (def.type === "BOOLEAN") {
        const trueCount = await prisma.product.count({
          where: {
            AND: [
              where,
              { attributeValues: { some: { attribute: { key: def.key }, valueBool: true } } },
            ],
          },
        });
        if (trueCount === 0) return null;
        return { key: def.key, type: def.type, unit: def.unit, translations: def.translations, options: [], trueCount };
      }

      // RANGE
      const agg = await prisma.productAttributeValue.aggregate({
        where: { attribute: { key: def.key }, valueNumeric: { not: null }, product: where },
        _min: { valueNumeric: true },
        _max: { valueNumeric: true },
      });
      if (agg._min.valueNumeric == null) return null;
      return {
        key: def.key,
        type: def.type,
        unit: def.unit,
        translations: def.translations,
        options: [],
        bounds: { min: agg._min.valueNumeric, max: agg._max.valueNumeric },
      };
    }),
  );

  const facets = facetResults.filter((f): f is Facet => f !== null);

  // Base-refinement counts (brand, on-sale, product type). Each is disjunctive
  // like the attribute facets: every other active filter applies, but the
  // refinement's own selection is ignored so it stays countable while the buyer
  // narrows within it. Scoped to the category branch (empty branch = global,
  // which is what the `/products` and `/brands/[slug]` pages pass).
  const whereWithout = (
    omit: Partial<Record<"brandId" | "onSale" | "isDigital", true>>,
  ) =>
    buildPublicProductWhere({
      ...params.base,
      ...(omit.brandId && { brandId: undefined }),
      ...(omit.onSale && { onSale: null }),
      ...(omit.isDigital && { isDigital: null }),
      categoryId: params.deptDescendantIds,
      attributeFilters: params.attributeFilters,
    });

  const [groupedBrands, onSaleCount, groupedType] = await Promise.all([
    prisma.product.groupBy({
      by: ["brandId"],
      where: { AND: [whereWithout({ brandId: true }), { brandId: { not: null } }] },
      _count: { _all: true },
    }),
    prisma.product.count({
      where: { AND: [whereWithout({ onSale: true }), { compareAtPrice: { not: null } }] },
    }),
    prisma.product.groupBy({
      by: ["isDigital"],
      where: whereWithout({ isDigital: true }),
      _count: { _all: true },
    }),
  ]);

  const brandCounts: Record<string, number> = {};
  for (const g of groupedBrands) {
    if (g.brandId) brandCounts[g.brandId] = g._count._all;
  }

  const isDigitalCounts = { true: 0, false: 0 };
  for (const g of groupedType) {
    if (g.isDigital) isDigitalCounts.true = g._count._all;
    else isDigitalCounts.false = g._count._all;
  }

  return { facets, brandCounts, onSaleCount, isDigitalCounts };
}
