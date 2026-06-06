"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { getBrandName } from "@/features/brands/utils/translations";
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
  FILTER_OPTIONS_VISIBLE_LIMIT,
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
  const locale = useLocale();
  const currency = useCurrencyStore((s) => s.currency);
  const currencySymbol = getCurrencyConfig(currency).symbol;

  // "title" sort dropped when title moved to ProductTranslation.
  const SORT_OPTIONS = [
    { value: "createdAt", label: t("myProducts.dateAdded") },
    { value: "price", label: t("myProducts.price") },
    { value: "status", label: t("products.status") },
  ];

  const [params, setParams] = useQueryStates(myProductSearchParams, {
    shallow: false,
    throttleMs: 300,
  });

  // Bypass nuqs's internal pending-queue cache for the user-typed `search` field:
  // it can leak across navigation (queue is a global singleton). Read directly
  // from the URL so navigating to a clean URL always starts empty.
  const urlSearchParams = useSearchParams();
  const search = urlSearchParams.get("search") ?? "";

  // Disjunctive facet counts (status + brand) for the sidebar - same treatment
  // as the admin product list: each facet ignores its own selection so it stays
  // countable while checked.
  const countsQuery = useQuery<{
    status: Record<string, number>;
    brand: Record<string, number>;
  }>({
    queryKey: [
      "my-products",
      "counts",
      search,
      params.status.join(","),
      params.brandId.join(","),
      params.minPrice,
      params.maxPrice,
      currency,
    ],
    queryFn: async () => {
      const rate = useCurrencyStore.getState().currentRate();
      const sp = new URLSearchParams();
      if (search) sp.set("search", search);
      for (const s of params.status) sp.append("status", s);
      for (const id of params.brandId) sp.append("brandId", id);
      if (params.minPrice != null) sp.set("minPrice", String(params.minPrice / rate));
      if (params.maxPrice != null) sp.set("maxPrice", String(params.maxPrice / rate));
      const { data } = await axios.get(`/api/dashboard/my-products/counts?${sp.toString()}`);
      return data as { status: Record<string, number>; brand: Record<string, number> };
    },
  });
  const countsReady = countsQuery.isSuccess;
  const statusCounts = useMemo(() => countsQuery.data?.status ?? {}, [countsQuery.data]);
  const brandCounts = useMemo(() => countsQuery.data?.brand ?? {}, [countsQuery.data]);

  const filterGroups: FilterGroup[] = useMemo(() => {
    // Status: small fixed enum, always shown (with counts, including 0).
    const statusOption = (value: string, label: string) =>
      countsReady ? { value, label, count: statusCounts[value] ?? 0 } : { value, label };

    const base: FilterGroup[] = [
      {
        type: "checkbox",
        key: "status",
        label: t("products.status"),
        options: [
          statusOption("DRAFT", t("myProducts.draft")),
          statusOption("PUBLISHED", t("myProducts.published")),
          statusOption("ARCHIVED", t("myProducts.archived")),
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
    // Brand: long list, show counts and hide brands with no products in the
    // current result set (selected brand stays visible so it can be cleared).
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
    if (brandOptions.length === 0) return base;
    return [
      ...base,
      {
        type: "checkbox" as const,
        key: "brandId",
        label: t("products.brand"),
        options: brandOptions,
        maxVisible: FILTER_OPTIONS_VISIBLE_LIMIT,
      },
    ];
  }, [
    brands,
    t,
    currencySymbol,
    locale,
    countsReady,
    statusCounts,
    brandCounts,
    params.brandId,
  ]);

  const filters: MyProductFilters = {
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
          search={search}
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