"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { cn } from "@/lib/utils";
import { useQueryStates } from "nuqs";
import { orgOrderSearchParams, type OrgOrderFilters } from "@/lib/query/searchParams";
import { SearchToolbar } from "@/components/search/SearchToolbar";
import { FilterSidebar, type FilterGroup, type FilterValues } from "@/components/search/FilterSidebar";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { OrgOrdersList } from "./OrgOrdersList";
import { useActiveOrgId } from "@/features/organizations/components/ActiveOrgContext";

export function OrgOrdersPage() {
  const t = useTranslations("orgOrders");
  const orgId = useActiveOrgId();

  const SORT_OPTIONS = [
    { value: "createdAt", label: t("date") },
    { value: "total", label: t("total") },
  ];

  const [params, setParams] = useQueryStates(orgOrderSearchParams, {
    shallow: false,
    throttleMs: 300,
  });

  // Bypass nuqs's internal pending-queue cache for the user-typed `search` field:
  // it can leak across navigation (queue is a global singleton). Read directly
  // from the URL so navigating to a clean URL always starts empty.
  const urlSearchParams = useSearchParams();
  const search = urlSearchParams.get("search") ?? "";

  // Disjunctive status counts for the sidebar - ignores the status selection
  // but applies the active search and org scope, matching the list.
  const countsQuery = useQuery<{ status: Record<string, number> }>({
    queryKey: ["org-orders", "counts", orgId, search],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (search) sp.set("search", search);
      const { data } = await axios.get(`/api/dashboard/org-orders/counts?${sp.toString()}`);
      return data as { status: Record<string, number> };
    },
  });
  const countsReady = countsQuery.isSuccess;
  const statusCounts = useMemo(() => countsQuery.data?.status ?? {}, [countsQuery.data]);

  // Status is a small fixed enum: every option stays visible (with a count,
  // including 0) so the filter set is stable - GitHub/Shopify convention.
  const FILTER_GROUPS: FilterGroup[] = useMemo(() => {
    const opt = (value: string, label: string) =>
      countsReady ? { value, label, count: statusCounts[value] ?? 0 } : { value, label };
    return [
      {
        type: "checkbox",
        key: "status",
        label: t("status"),
        options: [
          opt("PENDING", t("pending")),
          opt("PROCESSING", t("processing")),
          opt("SHIPPED", t("shipped")),
          opt("DELIVERED", t("delivered")),
          opt("COMPLETED", t("completed")),
          opt("CANCELLED", t("cancelled")),
          opt("REFUNDED", t("refunded")),
        ],
        // Fixed option set: stays clickable while counts load, only the
        // numbers are placeholdered.
        countsPending: !countsReady,
      },
    ];
  }, [t, countsReady, statusCounts]);

  const filters: OrgOrderFilters = {
    search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    status: params.status,
  };

  const filterValues: FilterValues = { status: params.status };

  // Filter interactions snap the (list-owned) scroll back to the top - see
  // resetScrollKey on useInfiniteVirtualList.
  const [scrollResetToken, setScrollResetToken] = useState(0);
  const resetListScroll = () => setScrollResetToken((n) => n + 1);

  const handleFilterChange = (key: string, value: string[] | [number?, number?] | number | null) => {
    resetListScroll();
    if (key === "status") setParams({ status: value as string[] });
  };

  const handleFilterClear = () => {
    resetListScroll();
    setParams({ status: [] });
  };

  const handleFilterRemove = (key: string, value?: string) => {
    resetListScroll();
    if (key === "status" && value) {
      setParams({ status: params.status.filter((s) => s !== value) });
    }
  };

  const hasActiveFilters = Object.values(filterValues).some((v) =>
    Array.isArray(v) ? v.some((item) => item != null) : v != null,
  );

  return (
    <div className="flex gap-6 flex-1 min-h-0">
      <FilterSidebar
        groups={FILTER_GROUPS}
        values={filterValues}
        onChange={handleFilterChange}
        onClear={handleFilterClear}
      />
      <div className="flex-1 min-w-0 flex flex-col gap-4 min-h-0">
        <SearchToolbar
          search={search}
          onSearchChange={(v) => setParams({ search: v })}
          searchPlaceholder={t("searchPlaceholder")}
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortByChange={(v) => setParams({ sortBy: v as OrgOrderFilters["sortBy"] })}
          onSortOrderChange={(v) => setParams({ sortOrder: v })}
          sortOptions={SORT_OPTIONS}
          filterGroups={FILTER_GROUPS}
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
              groups={FILTER_GROUPS}
              values={filterValues}
              onRemove={handleFilterRemove}
              onClearAll={handleFilterClear}
            />
          </div>
        </div>
        <OrgOrdersList filters={filters} scrollResetToken={scrollResetToken} />
      </div>
    </div>
  );
}