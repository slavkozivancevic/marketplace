"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { cn } from "@/lib/utils";
import { getBrandName } from "@/features/brands/utils/translations";
import { useQueryStates } from "nuqs";
import { useCurrencyStore, getCurrentRate } from "@/store/currency";
import { getCurrencyConfig } from "@/lib/currency";
import { useActiveOrgId } from "@/features/organizations/components/ActiveOrgContext";
import {
  myProductSearchParams,
  type MyProductFilters,
} from "@/lib/query/searchParams";
import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import type { MemberOption } from "@/types/types";

export function MyProductsPage({
  canWrite,
  brands = [],
  members = [],
}: {
  canWrite: boolean;
  brands?: BrandOption[];
  members?: MemberOption[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const currency = useCurrencyStore((s) => s.currency);
  const currencySymbol = getCurrencyConfig(currency).symbol;
  const orgId = useActiveOrgId();

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

  // Disjunctive facet counts (status + brand + createdBy) for the sidebar -
  // same treatment as the admin product list: each facet ignores its own
  // selection so it stays countable while checked.
  const countsQuery = useQuery<{
    status: Record<string, number>;
    brand: Record<string, number>;
    createdBy: Record<string, number>;
  }>({
    queryKey: [
      "my-products",
      "counts",
      orgId,
      search,
      params.status.join(","),
      params.brandId.join(","),
      params.createdBy.join(","),
      params.minPrice,
      params.maxPrice,
      currency,
    ],
    queryFn: async () => {
      const rate = getCurrentRate();
      const sp = new URLSearchParams();
      if (search) sp.set("search", search);
      for (const s of params.status) sp.append("status", s);
      for (const id of params.brandId) sp.append("brandId", id);
      for (const id of params.createdBy) sp.append("createdBy", id);
      if (params.minPrice != null) sp.set("minPrice", String(params.minPrice / rate));
      if (params.maxPrice != null) sp.set("maxPrice", String(params.maxPrice / rate));
      const { data } = await axios.get(`/api/dashboard/my-products/counts?${sp.toString()}`);
      return data as { status: Record<string, number>; brand: Record<string, number>; createdBy: Record<string, number> };
    },
  });
  const countsReady = countsQuery.isSuccess;
  const statusCounts = useMemo(() => countsQuery.data?.status ?? {}, [countsQuery.data]);
  const brandCounts = useMemo(() => countsQuery.data?.brand ?? {}, [countsQuery.data]);
  const createdByCounts = useMemo(() => countsQuery.data?.createdBy ?? {}, [countsQuery.data]);

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
    const groups = [...base];

    if (brands.length > 0) {
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

    if (members.length > 0) {
      // Same treatment as brand: counts + hide members with nothing in the
      // current result set, keeping a selected member visible so it can be
      // cleared.
      const selectedMembers = new Set(params.createdBy);
      const memberOptions = countsReady
        ? members
            .map((m) => ({
              value: m.id,
              label: m.name || m.email,
              count: createdByCounts[m.id] ?? 0,
            }))
            .filter((m) => m.count > 0 || selectedMembers.has(m.value))
        : members.map((m) => ({ value: m.id, label: m.name || m.email }));
      if (memberOptions.length > 0) {
        groups.push({
          type: "checkbox",
          key: "createdBy",
          label: t("products.createdBy"),
          options: memberOptions,
          maxVisible: FILTER_OPTIONS_VISIBLE_LIMIT,
        });
      }
    }

    return groups;
  }, [
    brands,
    members,
    t,
    currencySymbol,
    locale,
    countsReady,
    statusCounts,
    brandCounts,
    createdByCounts,
    params.brandId,
    params.createdBy,
  ]);

  const filters: MyProductFilters = {
    search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    status: params.status,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    brandId: params.brandId,
    createdBy: params.createdBy,
  };

  const filterValues: FilterValues = {
    status: params.status,
    price: [params.minPrice ?? undefined, params.maxPrice ?? undefined],
    brandId: params.brandId,
    createdBy: params.createdBy,
  };

  // Filter interactions snap the (list-owned) scroll back to the top - see
  // resetScrollKey on useInfiniteVirtualList.
  const [scrollResetToken, setScrollResetToken] = useState(0);
  const resetListScroll = () => setScrollResetToken((n) => n + 1);

  const handleFilterChange = (
    key: string,
    value: string[] | [number?, number?] | number | null,
  ) => {
    resetListScroll();
    if (key === "status") {
      setParams({ status: value as string[] });
    } else if (key === "price") {
      const [min, max] = value as [number?, number?];
      setParams({ minPrice: min ?? null, maxPrice: max ?? null });
    } else if (key === "brandId") {
      setParams({ brandId: value as string[] });
    } else if (key === "createdBy") {
      setParams({ createdBy: value as string[] });
    }
  };

  const handleFilterClear = () => {
    resetListScroll();
    setParams({ status: [], minPrice: null, maxPrice: null, brandId: [], createdBy: [] });
  };

  const handleFilterRemove = (key: string, value?: string) => {
    resetListScroll();
    if (key === "status" && value) {
      setParams({ status: params.status.filter((s) => s !== value) });
    } else if (key === "price") {
      setParams({ minPrice: null, maxPrice: null });
    } else if (key === "brandId") {
      setParams({ brandId: [] });
    } else if (key === "createdBy") {
      setParams({ createdBy: [] });
    }
  };

  const hasActiveFilters = Object.values(filterValues).some((v) =>
    Array.isArray(v) ? v.some((item) => item != null) : v != null,
  );

  return (
    <div className="flex gap-6 flex-1 min-h-0">
      <FilterSidebar
        groups={filterGroups}
        values={filterValues}
        onChange={handleFilterChange}
        onClear={handleFilterClear}
      />
      <div className="flex-1 min-w-0 flex flex-col gap-4 min-h-0">
        {!canWrite && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>{t("myProducts.readOnly")}</AlertTitle>
            <AlertDescription>{t("myProducts.readOnlyDesc")}</AlertDescription>
          </Alert>
        )}
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
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            hasActiveFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <ActiveFilters
              groups={filterGroups}
              values={filterValues}
              onRemove={handleFilterRemove}
              onClearAll={handleFilterClear}
            />
          </div>
        </div>
        <MyProductsList canWrite={canWrite} filters={filters} scrollResetToken={scrollResetToken} />
      </div>
    </div>
  );
}