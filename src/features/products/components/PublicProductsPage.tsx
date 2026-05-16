"use client";

import { useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import {
  productSearchParams,
  type ProductFilters,
} from "@/lib/query/searchParams";
import {
  FilterSidebar,
  type FilterGroup,
  type FilterValues,
} from "@/components/search/FilterSidebar";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { PublicProductsGrid } from "./PublicProductsGrid";
import type { BrandOption } from "@/features/brands/components/BrandSelect";
import { DepartmentSearchBar } from "@/features/categories/components/DepartmentSearchBar";
import type { CategoryTreeItem } from "@/features/categories/db/categories";
import { useCurrencyStore } from "@/store/currency";
import { getCurrencyConfig } from "@/lib/currency";

export function PublicProductsPage({
  brands = [],
  categoryTree = [],
  footer,
}: {
  brands?: BrandOption[];
  categoryTree?: CategoryTreeItem[];
  footer?: React.ReactNode;
}) {
  const t = useTranslations();
  const { currency } = useCurrencyStore();
  const currencySymbol = getCurrencyConfig(currency).symbol;

  const SORT_OPTIONS = [
    { value: "createdAt", label: t("products.dateAdded") },
    { value: "price", label: t("products.price") },
    { value: "title", label: t("products.name") },
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
      {
        type: "checkbox",
        key: "onSale",
        label: t("products.deals"),
        options: [{ value: "true", label: t("products.onSale") }],
      },
      {
        type: "checkbox",
        key: "isDigital",
        label: t("products.productType"),
        options: [
          { value: "false", label: t("products.physical") },
          { value: "true", label: t("products.digital") },
        ],
      },
    ];

    if (brands.length > 0) {
      groups.push({
        type: "checkbox",
        key: "brandId",
        label: t("products.brand"),
        options: brands.map((b) => ({ value: b.id, label: b.name })),
        maxVisible: 5,
      });
    }

    return groups;
  }, [brands, t, currencySymbol]);

  // ---- Filter values ----
  // URL stores values as typed by user (in selected currency) — no conversion, no rounding.
  const filterValues: FilterValues = {
    price: [params.minPrice ?? undefined, params.maxPrice ?? undefined],
    minRating: params.minRating ?? null,
    onSale: params.onSale === true ? ["true"] : [],
    isDigital: params.isDigital != null ? [String(params.isDigital)] : [],
    brandId: params.brandId,
  };

  // ---- Handlers ----
  const handleFilterChange = (
    key: string,
    value: string[] | [number?, number?] | number | null,
  ) => {
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
    });
  };

  const handleFilterRemove = (key: string) => {
    if (key === "price") setParams({ minPrice: null, maxPrice: null });
    else if (key === "minRating") setParams({ minRating: null });
    else if (key === "onSale") setParams({ onSale: null });
    else if (key === "isDigital") setParams({ isDigital: null });
    else if (key === "brandId") setParams({ brandId: [] });
  };

  const filters: ProductFilters = {
    search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    // Raw display-currency values — buildFetcher converts to USD at fetch time.
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    onSale: params.onSale,
    isDigital: params.isDigital,
    brandId: params.brandId,
    minRating: params.minRating,
    dept: params.dept,
  };

  const outerScrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">

      {/* Search bar — shrink-0, ne skroluje */}
      <div className="flex flex-col gap-2 shrink-0 px-6">
        <DepartmentSearchBar
          tree={categoryTree}
          dept={params.dept}
          onDeptChange={(slug) => setParams({ dept: slug, search: "" })}
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