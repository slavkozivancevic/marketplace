"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useCurrencyStore } from "@/store/currency";
import { getCurrencyConfig } from "@/lib/currency";
import {
  myProductSearchParams,
  type MyProductFilters,
} from "@/lib/query/searchParams";
import { SearchToolbar } from "@/components/search/SearchToolbar";
import {
  FilterSidebar,
  type FilterGroup,
  type FilterValues,
} from "@/components/search/FilterSidebar";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { MyProductsList } from "./MyProductsList";
import type { BrandOption } from "@/features/brands/components/BrandSelect";

export function MyProductsPage({
  canWrite,
  brands = [],
}: {
  canWrite: boolean;
  brands?: BrandOption[];
}) {
  const t = useTranslations();
  const currency = useCurrencyStore((s) => s.currency);
  const currencySymbol = getCurrencyConfig(currency).symbol;

  const SORT_OPTIONS = [
    { value: "createdAt", label: t("myProducts.dateAdded") },
    { value: "price", label: t("myProducts.price") },
    { value: "title", label: t("myProducts.name") },
    { value: "status", label: t("products.status") },
  ];

  const [params, setParams] = useQueryStates(myProductSearchParams, {
    shallow: false,
    throttleMs: 300,
  });

  const filterGroups: FilterGroup[] = useMemo(() => {
    const base: FilterGroup[] = [
      {
        type: "checkbox",
        key: "status",
        label: t("products.status"),
        options: [
          { value: "DRAFT", label: t("myProducts.draft") },
          { value: "PUBLISHED", label: t("myProducts.published") },
          { value: "ARCHIVED", label: t("myProducts.archived") },
        ],
      },
      {
        type: "range",
        key: "price",
        label: t("myProducts.price"),
        prefix: currencySymbol,
        min: 0,
        step: 1,
      },
    ];
    if (brands.length === 0) return base;
    return [
      ...base,
      {
        type: "checkbox" as const,
        key: "brandId",
        label: t("products.brand"),
        options: brands.map((b) => ({ value: b.id, label: b.name })),
      },
    ];
  }, [brands, t, currencySymbol]);

  const filters: MyProductFilters = {
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    status: params.status,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    brandId: params.brandId,
  };

  const filterValues: FilterValues = {
    status: params.status,
    price: [params.minPrice ?? undefined, params.maxPrice ?? undefined],
    brandId: params.brandId,
  };

  const handleFilterChange = (
    key: string,
    value: string[] | [number?, number?] | number | null,
  ) => {
    if (key === "status") {
      setParams({ status: value as string[] });
    } else if (key === "price") {
      const [min, max] = value as [number?, number?];
      setParams({ minPrice: min ?? null, maxPrice: max ?? null });
    } else if (key === "brandId") {
      setParams({ brandId: value as string[] });
    }
  };

  const handleFilterClear = () => {
    setParams({ status: [], minPrice: null, maxPrice: null, brandId: [] });
  };

  const handleFilterRemove = (key: string, value?: string) => {
    if (key === "status" && value) {
      setParams({ status: params.status.filter((s) => s !== value) });
    } else if (key === "price") {
      setParams({ minPrice: null, maxPrice: null });
    } else if (key === "brandId") {
      setParams({ brandId: [] });
    }
  };

  return (
    <div className="flex gap-6 flex-1 min-h-0">
      <FilterSidebar
        groups={filterGroups}
        values={filterValues}
        onChange={handleFilterChange}
        onClear={handleFilterClear}
      />
      <div className="flex-1 min-w-0 flex flex-col gap-4 min-h-0">
        <SearchToolbar
          search={params.search}
          onSearchChange={(v) => setParams({ search: v })}
          searchPlaceholder={t("myProducts.searchPlaceholder")}
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortByChange={(v) =>
            setParams({ sortBy: v as MyProductFilters["sortBy"] })
          }
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
        <MyProductsList canWrite={canWrite} filters={filters} />
      </div>
    </div>
  );
}