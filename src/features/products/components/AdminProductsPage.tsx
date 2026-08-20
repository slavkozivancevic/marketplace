"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { cn } from "@/lib/utils";
import { useQueryStates } from "nuqs";
import { useCurrencyStore, getCurrentRate } from "@/store/currency";
import { getCurrencyConfig } from "@/lib/currency";
import {
  adminProductSearchParams,
  type AdminProductFilters,
} from "@/lib/query/searchParams";
import { SearchToolbar } from "@/components/search/SearchToolbar";
import {
  FilterSidebar,
  FILTER_OPTIONS_VISIBLE_LIMIT,
  type FilterGroup,
  type FilterValues,
} from "@/components/search/FilterSidebar";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { AdminProductsList } from "./AdminProductsList";
import type { BrandOption } from "@/features/brands/components/BrandSelect";
import { getBrandName } from "@/features/brands/utils/translations";
import type { MemberOption } from "@/types/types";

export function AdminProductsPage({
  brands = [],
  members = [],
}: {
  brands?: BrandOption[];
  members?: MemberOption[];
}) {
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

  const [, setParams] = useQueryStates(adminProductSearchParams, {
    shallow: false,
    throttleMs: 300,
  });

  // Read EVERY filter from the URL, not from nuqs's returned state. nuqs keeps a
  // global pending-queue singleton whose values leak across a route change
  // (e.g. /products -> /admin/products briefly shows the other page's filters).
  // The committed URL is the single source of truth and is always clean after a
  // real navigation. Writes still go through nuqs `setParams`; filter clicks
  // pass `throttleMs: 0` (see handlers) so the URL commits instantly with no
  // pending value left to leak.
  const urlSearchParams = useSearchParams();
  const search = urlSearchParams.get("search") ?? "";
  const params = useMemo(() => ({
    sortBy: ((urlSearchParams.get("sortBy") as AdminProductFilters["sortBy"]) || "createdAt"),
    sortOrder: (urlSearchParams.get("sortOrder") === "asc" ? "asc" : "desc") as "asc" | "desc",
    status: urlSearchParams.get("status")?.split(",").filter(Boolean) ?? [],
    minPrice: urlSearchParams.get("minPrice") ? Number(urlSearchParams.get("minPrice")) : null,
    maxPrice: urlSearchParams.get("maxPrice") ? Number(urlSearchParams.get("maxPrice")) : null,
    brandId: urlSearchParams.get("brandId")?.split(",").filter(Boolean) ?? [],
    createdBy: urlSearchParams.get("createdBy")?.split(",").filter(Boolean) ?? [],
  }), [urlSearchParams]);

  // Disjunctive facet counts (status + brand + createdBy) for the sidebar.
  // Mirrors the list's filters so the numbers track the visible result set;
  // each facet's own selection is ignored server-side so it stays countable
  // while checked.
  const countsQuery = useQuery<{
    status: Record<string, number>;
    brand: Record<string, number>;
    createdBy: Record<string, number>;
  }>({
    queryKey: [
      "products",
      "admin",
      "counts",
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
      const { data } = await axios.get(`/api/admin/products/counts?${sp.toString()}`);
      return data as { status: Record<string, number>; brand: Record<string, number>; createdBy: Record<string, number> };
    },
  });
  const countsReady = countsQuery.isSuccess;
  const statusCounts = useMemo(() => countsQuery.data?.status ?? {}, [countsQuery.data]);
  const brandCounts = useMemo(() => countsQuery.data?.brand ?? {}, [countsQuery.data]);
  const createdByCounts = useMemo(() => countsQuery.data?.createdBy ?? {}, [countsQuery.data]);

  const filterGroups: FilterGroup[] = useMemo(() => {
    // Status is a small fixed enum: always show every option (with a count,
    // including 0) so the filter set stays stable - GitHub/Shopify convention.
    const statusOption = (value: string, label: string) =>
      countsReady ? { value, label, count: statusCounts[value] ?? 0 } : { value, label };

    const groups: FilterGroup[] = [
      {
        type: "checkbox",
        key: "status",
        label: t("products.status"),
        options: [
          statusOption("DRAFT", t("products.draft")),
          statusOption("PUBLISHED", t("products.published")),
          statusOption("ARCHIVED", t("products.archived")),
        ],
        // Fixed option set: stays clickable while counts load, only the
        // numbers are placeholdered.
        countsPending: !countsReady,
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
      // Brand is a long list: show counts and hide brands with no products in
      // the current result set (Amazon-style), keeping any selected brand
      // visible so it can be cleared.
      //
      // Because that membership depends on the counts query, the group is
      // `pending` until it resolves - see CheckboxFilterGroup.pending. Painting
      // the unfiltered list first made brands appear and then vanish.
      const selectedBrands = new Set(params.brandId);
      const brandOptions = countsReady
        ? brands
            .map((b) => ({
              value: b.id,
              label: getBrandName(b, locale),
              count: brandCounts[b.id] ?? 0,
            }))
            .filter((b) => b.count > 0 || selectedBrands.has(b.value))
        // Still the full list while pending: <CheckboxFilter> ignores it and
        // draws placeholders, but <ActiveFilters> resolves a selected chip's
        // label out of `options` and would otherwise print a raw UUID.
        : brands.map((b) => ({ value: b.id, label: getBrandName(b, locale) }));
      if (brandOptions.length > 0) {
        groups.push({
          type: "checkbox",
          key: "brandId",
          label: t("products.brand"),
          options: brandOptions,
          maxVisible: FILTER_OPTIONS_VISIBLE_LIMIT,
          pending: !countsReady,
          pendingRows: Math.min(brands.length, FILTER_OPTIONS_VISIBLE_LIMIT),
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
          pending: !countsReady,
          pendingRows: Math.min(members.length, FILTER_OPTIONS_VISIBLE_LIMIT),
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

  const filters: AdminProductFilters = {
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

  // Filter writes commit immediately (no throttle) so nothing stays queued to
  // leak into the next route, and the URL-derived read above updates at once.
  const NOW = { throttleMs: 0 } as const;

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
      setParams({ status: value as string[] }, NOW);
    } else if (key === "price") {
      const [min, max] = value as [number?, number?];
      setParams({ minPrice: min ?? null, maxPrice: max ?? null }, NOW);
    } else if (key === "brandId") {
      const vals = value as string[];
      setParams({ brandId: vals }, NOW);
    } else if (key === "createdBy") {
      const vals = value as string[];
      setParams({ createdBy: vals }, NOW);
    }
  };

  const handleFilterClear = () => {
    resetListScroll();
    setParams({ status: [], minPrice: null, maxPrice: null, brandId: [], createdBy: [] }, NOW);
  };

  const handleFilterRemove = (key: string, value?: string) => {
    resetListScroll();
    if (key === "status" && value) {
      setParams({ status: params.status.filter((s) => s !== value) }, NOW);
    } else if (key === "price") {
      setParams({ minPrice: null, maxPrice: null }, NOW);
    } else if (key === "brandId") {
      setParams({ brandId: [] }, NOW);
    } else if (key === "createdBy") {
      setParams({ createdBy: [] }, NOW);
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
        <SearchToolbar
          search={search}
          onSearchChange={(v) => setParams({ search: v })}
          searchPlaceholder={t("products.searchPlaceholder")}
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortByChange={(v) =>
            setParams({ sortBy: v as AdminProductFilters["sortBy"] }, NOW)
          }
          onSortOrderChange={(v) => setParams({ sortOrder: v }, NOW)}
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
        <AdminProductsList filters={filters} scrollResetToken={scrollResetToken} />
      </div>
    </div>
  );
}
