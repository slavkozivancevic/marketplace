"use client";

import { useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { getBrandName } from "@/features/brands/utils/translations";
import { getLabel } from "@/features/attributes/utils/translations";
import type { CategoryFacetsResult } from "@/features/attributes/db/facets";
import {
  parseAttrs,
  serializeAttrs,
  findOptionFilter,
  findRangeFilter,
  hasBoolFilter,
  setOptionFilter,
  setRangeFilter,
  setBoolFilter,
} from "@/lib/query/attrs";
import { useQueryStates } from "nuqs";
import {
  productSearchParams,
  type ProductFilters,
} from "@/lib/query/searchParams";
import {
  FilterSidebar,
  FILTER_OPTIONS_VISIBLE_LIMIT,
  type FilterGroup,
  type FilterValues,
} from "@/components/search/FilterSidebar";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { PublicProductsGrid } from "./PublicProductsGrid";
import type { BrandOption } from "@/features/brands/components/BrandSelect";
import { DepartmentSearchBar } from "@/features/categories/components/DepartmentSearchBar";
import type { CategoryTreeItem } from "@/features/categories/db/categories";
import { getCategorySlug } from "@/features/categories/utils/translations";
import { useRouter } from "@/i18n/navigation";
import { useCurrencyStore } from "@/store/currency";
import { getCurrencyConfig } from "@/lib/currency";

/** Sheet close animation duration (see `data-closed:animate-out` +
 *  `transition duration-200` in `components/ui/sheet`). The dept-change
 *  navigation waits this long so the drawer is fully closed/unmounted before
 *  the route commit, avoiding a slide-out animation restart ("flash"). A small
 *  buffer over 200ms covers timing jitter. */
const SHEET_CLOSE_MS = 220;

/** Finds a category node by any locale's slug (the dept selector emits the
 *  default-locale slug, but we resolve robustly regardless of which one). */
function findDeptNodeBySlug(
  tree: CategoryTreeItem[],
  slug: string,
): CategoryTreeItem | null {
  for (const node of tree) {
    if (node.translations.some((tr) => tr.slug === slug)) return node;
    const found = findDeptNodeBySlug(node.children, slug);
    if (found) return found;
  }
  return null;
}

/**
 * Universal product catalog used by `/products`, `/brands/[slug]` and
 * `/categories/[slug]`.
 *
 *   - `lockedBrandId`  set by `/brands/[slug]` -> brand filter is removed
 *     from the sidebar and the brand-id is force-merged into every query
 *     against `/api/products`. NOT persisted to the URL (owned by the route).
 *   - `currentDept`    set by `/categories/[slug]` -> the department this
 *     page is scoped to. The department selector stays fully visible and
 *     pre-selects this dept; the page behaves exactly like `/products` but
 *     pre-filtered. Department is path-based, so changing it navigates to
 *     the chosen department's page rather than toggling a query param.
 */
export function PublicProductsPage({
  brands = [],
  categoryTree = [],
  footer,
  lockedBrandId,
  currentDept,
}: {
  brands?: BrandOption[];
  categoryTree?: CategoryTreeItem[];
  footer?: React.ReactNode;
  lockedBrandId?: string;
  currentDept?: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  // Department lives in the path (`/categories/[slug]`), so switching it is a
  // navigation: pick a dept -> its page, "All" -> the full catalog. Resolving
  // the node lets us emit the locale-correct slug for the target URL.
  //
  // The selector opens a Radix Sheet. Navigating while the Sheet is still
  // animating closed has two problems: (1) it can leave `pointer-events: none`
  // stuck on <body>, and (2) the route commit re-renders the portaled, mid-exit
  // SheetContent and restarts its slide-out animation - the drawer visibly pops
  // back open and slides out again. Defer the push until the close animation
  // finishes and the Sheet content has unmounted, so there is nothing left to
  // disturb. Must stay >= the Sheet's close animation duration (200ms).
  const handleDeptChange = (slug: string) => {
    const navigate = () => {
      if (!slug) {
        router.push("/products");
        return;
      }
      const node = findDeptNodeBySlug(categoryTree, slug);
      const localizedSlug = node ? getCategorySlug(node, locale) : slug;
      router.push({
        pathname: "/categories/[slug]",
        params: { slug: localizedSlug },
      });
    };
    setTimeout(navigate, SHEET_CLOSE_MS);
  };
  const { currency } = useCurrencyStore();
  const currencySymbol = getCurrencyConfig(currency).symbol;

  // "title" sort dropped when title moved to ProductTranslation.
  const SORT_OPTIONS = [
    { value: "createdAt", label: t("products.dateAdded") },
    { value: "price", label: t("products.price") },
    { value: "avgRating", label: t("products.rating") },
  ];

  const [params, setParams] = useQueryStates(productSearchParams, {
    shallow: false,
    throttleMs: 300,
  });

  // Bypass nuqs's internal pending-queue cache for the user-typed `search` field:
  // it can leak across navigation (queue is a global singleton). Read directly
  // from the URL so navigating to a clean URL always starts empty.
  const urlSearchParams = useSearchParams();
  const search = urlSearchParams.get("search") ?? "";

  const dept = currentDept ?? params.dept;
  const attrFilters = useMemo(() => parseAttrs(params.attrs), [params.attrs]);
  const lockedOrParamBrand = lockedBrandId ? [lockedBrandId] : params.brandId;

  // ---- Category facets (with counts) ----
  // Counts reflect every other active filter (incl. other attribute selections)
  // so the Amazon-style multi-select facet stays meaningful as you refine.
  const facetsQuery = useQuery<CategoryFacetsResult>({
    queryKey: [
      "facets",
      dept,
      currency,
      params.minPrice,
      params.maxPrice,
      params.onSale,
      params.isDigital,
      params.minRating,
      lockedOrParamBrand.join(","),
      search,
      params.attrs,
      locale,
    ],
    queryFn: async () => {
      const rate = useCurrencyStore.getState().currentRate();
      const sp = new URLSearchParams();
      sp.set("dept", dept);
      sp.set("searchLocale", locale);
      if (search) sp.set("search", search);
      if (params.minPrice != null) sp.set("minPrice", String(params.minPrice / rate));
      if (params.maxPrice != null) sp.set("maxPrice", String(params.maxPrice / rate));
      if (params.onSale === true) sp.set("onSale", "true");
      if (params.isDigital != null) sp.set("isDigital", String(params.isDigital));
      for (const id of lockedOrParamBrand) sp.append("brandId", id);
      if (params.minRating != null) sp.set("minRating", String(params.minRating));
      if (params.attrs) sp.set("attrs", params.attrs);
      const { data } = await axios.get(`/api/facets?${sp.toString()}`);
      return data as CategoryFacetsResult;
    },
  });
  const facets = useMemo(() => facetsQuery.data?.facets ?? [], [facetsQuery.data]);
  const brandCounts = useMemo(
    () => facetsQuery.data?.brandCounts ?? {},
    [facetsQuery.data],
  );
  // Base-refinement counts are only authoritative once the request resolves;
  // until then the toggles render without counts (and without hide-empty) to
  // avoid a flash of disappearing filters on first paint.
  const countsReady = facetsQuery.isSuccess;
  const onSaleCount = facetsQuery.data?.onSaleCount ?? 0;
  const isDigitalCounts = useMemo(
    () => facetsQuery.data?.isDigitalCounts ?? { true: 0, false: 0 },
    [facetsQuery.data],
  );

  // ---- Filter groups ----
  const filterGroups: FilterGroup[] = useMemo(() => {
    const groups: FilterGroup[] = [
      {
        type: "range",
        key: "price",
        label: t("products.price"),
        prefix: currencySymbol,
        min: 0,
        step: 1,
      },
      {
        type: "rating",
        key: "minRating",
        label: t("search.customerReviews"),
      },
    ];

    // Deals + product type are discrete refinements, so - like brand and the
    // attribute facets - they carry disjunctive counts and hide when nothing
    // matches. A selected value stays visible so the buyer can always clear it.
    // Until the first facet request resolves they render plain (no count, no
    // hide-empty) to avoid a flash of disappearing filters.
    if (!countsReady || onSaleCount > 0 || params.onSale === true) {
      groups.push({
        type: "checkbox",
        key: "onSale",
        label: t("products.deals"),
        options: [
          countsReady
            ? { value: "true", label: t("products.onSale"), count: onSaleCount }
            : { value: "true", label: t("products.onSale") },
        ],
      });
    }

    const typeOptions: { value: string; label: string; count?: number }[] = countsReady
      ? [
          { value: "false", label: t("products.physical"), count: isDigitalCounts.false },
          { value: "true", label: t("products.digital"), count: isDigitalCounts.true },
        ].filter(
          (o) =>
            o.count > 0 ||
            (o.value === "false" ? params.isDigital === false : params.isDigital === true),
        )
      : [
          { value: "false", label: t("products.physical") },
          { value: "true", label: t("products.digital") },
        ];
    if (typeOptions.length > 0) {
      groups.push({
        type: "checkbox",
        key: "isDigital",
        label: t("products.productType"),
        options: typeOptions,
      });
    }

    // Brand: same disjunctive-count + hide-empty treatment as the facets. Counts
    // come from the facet endpoint, which now computes them globally too, so this
    // works on `/products` and brand pages, not just category pages. Hide the
    // group entirely when no brand matches (no orphan "Brand" heading). Hidden
    // when the page already pins a brand (brand storefront). Until the request
    // resolves, show the full count-less list to avoid an empty-group flash.
    if (brands.length > 0 && !lockedBrandId) {
      const selectedBrands = new Set(params.brandId);
      const brandOptions = countsReady
        ? brands
            .map((b) => ({
              value: b.id,
              label: getBrandName(b, locale),
              count: brandCounts[b.id] ?? 0,
            }))
            .filter((b) => b.count > 0 || selectedBrands.has(b.value))
        : brands.map((b) => ({ value: b.id, label: getBrandName(b, locale) }));
      if (brandOptions.length > 0) {
        groups.push({
          type: "checkbox",
          key: "brandId",
          label: t("products.brand"),
          options: brandOptions,
          maxVisible: FILTER_OPTIONS_VISIBLE_LIMIT,
        });
      }
    }

    // Category-specific facets (own + inherited), keyed `attr:<attributeKey>`.
    for (const f of facets) {
      const baseLabel = getLabel(f.translations, locale);
      if (f.type === "SELECT" || f.type === "MULTI_SELECT") {
        groups.push({
          type: "checkbox",
          key: `attr:${f.key}`,
          label: baseLabel,
          maxVisible: FILTER_OPTIONS_VISIBLE_LIMIT,
          options: f.options.map((o) => ({
            value: o.value,
            label: getLabel(o.translations, locale),
            count: o.count,
          })),
        });
      } else if (f.type === "BOOLEAN") {
        groups.push({
          type: "checkbox",
          key: `attr:${f.key}`,
          label: baseLabel,
          options: [{ value: "on", label: t("search.yes"), count: f.trueCount }],
        });
      } else if (f.type === "RANGE") {
        groups.push({
          type: "range",
          key: `attr:${f.key}`,
          label: f.unit ? `${baseLabel} (${f.unit})` : baseLabel,
          min: f.bounds?.min ?? undefined,
          max: f.bounds?.max ?? undefined,
          step: 1,
        });
      }
    }

    return groups;
  }, [
    brands,
    lockedBrandId,
    t,
    currencySymbol,
    locale,
    facets,
    countsReady,
    brandCounts,
    onSaleCount,
    isDigitalCounts,
    params.brandId,
    params.onSale,
    params.isDigital,
  ]);

  // ---- Filter values ----
  // URL stores values as typed by user (in selected currency) - no conversion, no rounding.
  const filterValues: FilterValues = {
    price: [params.minPrice ?? undefined, params.maxPrice ?? undefined],
    minRating: params.minRating ?? null,
    onSale: params.onSale === true ? ["true"] : [],
    isDigital: params.isDigital != null ? [String(params.isDigital)] : [],
    brandId: params.brandId,
  };
  for (const f of facets) {
    const k = `attr:${f.key}`;
    if (f.type === "RANGE") {
      const [mn, mx] = findRangeFilter(attrFilters, f.key);
      filterValues[k] = [mn ?? undefined, mx ?? undefined];
    } else if (f.type === "BOOLEAN") {
      filterValues[k] = hasBoolFilter(attrFilters, f.key) ? ["on"] : [];
    } else {
      filterValues[k] = findOptionFilter(attrFilters, f.key);
    }
  }

  // ---- Handlers ----
  const handleFilterChange = (
    key: string,
    value: string[] | [number?, number?] | number | null,
  ) => {
    if (key.startsWith("attr:")) {
      const fk = key.slice(5);
      const facet = facets.find((f) => f.key === fk);
      let next = attrFilters;
      if (facet?.type === "RANGE") {
        const [min, max] = value as [number?, number?];
        next = setRangeFilter(attrFilters, fk, min ?? null, max ?? null);
      } else if (facet?.type === "BOOLEAN") {
        next = setBoolFilter(attrFilters, fk, (value as string[]).includes("on"));
      } else {
        next = setOptionFilter(attrFilters, fk, value as string[]);
      }
      setParams({ attrs: serializeAttrs(next) });
      return;
    }
    if (key === "price") {
      const [min, max] = value as [number?, number?];
      setParams({ minPrice: min ?? null, maxPrice: max ?? null });
    } else if (key === "minRating") {
      setParams({ minRating: (value as number | null) ?? null });
    } else if (key === "onSale") {
      const vals = value as string[];
      setParams({ onSale: vals.includes("true") ? true : null });
    } else if (key === "isDigital") {
      const vals = value as string[];
      if (vals.length === 0 || vals.length === 2) setParams({ isDigital: null });
      else setParams({ isDigital: vals[0] === "true" });
    } else if (key === "brandId") {
      setParams({ brandId: value as string[] });
    }
  };

  const handleFilterClear = () => {
    setParams({
      minPrice: null,
      maxPrice: null,
      onSale: null,
      isDigital: null,
      brandId: [],
      minRating: null,
      attrs: "",
    });
  };

  const handleFilterRemove = (key: string, value?: string) => {
    if (key.startsWith("attr:")) {
      const fk = key.slice(5);
      const facet = facets.find((f) => f.key === fk);
      if (value && (facet?.type === "SELECT" || facet?.type === "MULTI_SELECT")) {
        const nextVals = findOptionFilter(attrFilters, fk).filter((v) => v !== value);
        setParams({ attrs: serializeAttrs(setOptionFilter(attrFilters, fk, nextVals)) });
      } else {
        setParams({ attrs: serializeAttrs(attrFilters.filter((f) => f.key !== fk)) });
      }
    } else if (key === "price") setParams({ minPrice: null, maxPrice: null });
    else if (key === "minRating") setParams({ minRating: null });
    else if (key === "onSale") setParams({ onSale: null });
    else if (key === "isDigital") setParams({ isDigital: null });
    else if (key === "brandId") setParams({ brandId: [] });
  };

  const filters: ProductFilters = {
    search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    // Raw display-currency values - buildFetcher converts to USD at fetch time.
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    onSale: params.onSale,
    isDigital: params.isDigital,
    // Locked dimensions take precedence so the visitor can't unlock the
    // brand storefront / category page via URL tampering.
    brandId: lockedBrandId ? [lockedBrandId] : params.brandId,
    minRating: params.minRating,
    dept,
    attrs: params.attrs,
  };

  const outerScrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">

      {/* Search bar - shrink-0, ne skroluje */}
      <div className="flex flex-col gap-2 shrink-0 px-6">
        <DepartmentSearchBar
          tree={categoryTree}
          dept={currentDept ?? params.dept}
          onDeptChange={handleDeptChange}
          search={search}
          onSearchChange={(v) => setParams({ search: v })}
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortByChange={(v) => setParams({ sortBy: v as ProductFilters["sortBy"] })}
          onSortOrderChange={(v) => setParams({ sortOrder: v })}
          sortOptions={SORT_OPTIONS}
          filterGroups={filterGroups}
          filterValues={filterValues}
          onFilterChange={handleFilterChange}
          onFilterClear={handleFilterClear}
        />
        <ActiveFilters
          groups={filterGroups}
          values={filterValues}
          onRemove={handleFilterRemove}
          onClearAll={handleFilterClear}
        />
      </div>

      {/* Outer scroll container: sidebar + grid + footer */}
      <div ref={outerScrollRef} className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] flex flex-col">
        <div className="flex gap-6 flex-1 px-6">
          <FilterSidebar
            groups={filterGroups}
            values={filterValues}
            onChange={handleFilterChange}
            onClear={handleFilterClear}
            sticky
          />
          <div className="flex-1 min-w-0">
            <PublicProductsGrid filters={filters} scrollContainerRef={outerScrollRef} />
          </div>
        </div>
        <div className="mt-8 pb-6">{footer}</div>
      </div>
    </div>
  );
}