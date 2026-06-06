"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useCurrencyStore } from "@/store/currency";
import { getCurrencyConfig } from "@/lib/currency";
import {
  adminProductSearchParams,
  type AdminProductFilters,
} from "@/lib/query/searchParams";
import { SearchToolbar } from "@/components/search/SearchToolbar";
import {
  FilterSidebar,
  type FilterGroup,
  type FilterValues,
} from "@/components/search/FilterSidebar";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { AdminProductsList } from "./AdminProductsList";
import type { BrandOption } from "@/features/brands/components/BrandSelect";
import { getBrandName } from "@/features/brands/utils/translations";

export function AdminProductsPage({ brands = [] }: { brands?: BrandOption[] }) {
  const t = useTranslations();
  const locale = useLocale();
  const currency = useCurrencyStore((s) => s.currency);
  const currencySymbol = getCurrencyConfig(currency).symbol;

  // "title" sort dropped when title moved to ProductTranslation; sort by
  // createdAt / price / status only.
  const SORT_OPTIONS = [
    { value: "createdAt", label: t("products.dateAdded") },
    { value: "price", label: t("products.price") },
    { value: "status", label: t("products.status") },
  ];

  const [params, setParams] = useQueryStates(adminProductSearchParams, {
    shallow: false,
    throttleMs: 300,
  });

  // Bypass nuqs's internal pending-queue cache for the user-typed `search` field:
  // it can leak across navigation (queue is a global singleton). Read directly
  // from the URL so navigating to a clean URL always starts empty.
  const urlSearchParams = useSearchParams();
  const search = urlSearchParams.get("search") ?? "";

  const filterGroups: FilterGroup[] = useMemo(() => {
    const groups: FilterGroup[] = [
      {
        type: "checkbox",
        key: "status",
        label: t("products.status"),
        options: [
          { value: "DRAFT", label: t("products.draft") },
          { value: "PUBLISHED", label: t("products.published") },
          { value: "ARCHIVED", label: t("products.archived") },
        ],
      },
      {
        type: "range",
        key: "price",
        label: t("products.price"),
        prefix: currencySymbol,
        min: 0,
        step: 1,
      },
    ];
    if (brands.length > 0) {
      groups.push({
        type: "checkbox",
        key: "brandId",
        label: t("products.brand"),
        options: brands.map((b) => ({ value: b.id, label: getBrandName(b, locale) })),
      });
    }
    return groups;
  }, [brands, t, currencySymbol, locale]);

  const filters: AdminProductFilters = {
    search,
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
      const vals = value as string[];
      setParams({ brandId: vals });
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
          search={search}
          onSearchChange={(v) => setParams({ search: v })}
          searchPlaceholder={t("products.searchPlaceholder")}
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortByChange={(v) =>
            setParams({ sortBy: v as AdminProductFilters["sortBy"] })
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
        <AdminProductsList filters={filters} />
      </div>
    </div>
  );
}
