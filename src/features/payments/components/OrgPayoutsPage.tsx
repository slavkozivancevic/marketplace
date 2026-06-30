"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useQueryStates } from "nuqs";
import { orgPayoutSearchParams, type OrgPayoutFilters } from "@/lib/query/searchParams";
import { SearchToolbar } from "@/components/search/SearchToolbar";
import { FilterSidebar, type FilterGroup, type FilterValues } from "@/components/search/FilterSidebar";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { OrgPayoutsList } from "./OrgPayoutsList";
import { useActiveOrgId } from "@/features/organizations/components/ActiveOrgContext";

export function OrgPayoutsPage() {
  const t = useTranslations("payouts");
  const orgId = useActiveOrgId();

  const SORT_OPTIONS = [
    { value: "createdAt", label: t("date") },
    { value: "amount", label: t("amount") },
  ];

  const [params, setParams] = useQueryStates(orgPayoutSearchParams, {
    shallow: false,
    throttleMs: 300,
  });

  // Read `search` straight from the URL to dodge nuqs's global pending-queue
  // cache, which can leak across navigation (see OrgOrdersPage).
  const urlSearchParams = useSearchParams();
  const search = urlSearchParams.get("search") ?? "";

  // Disjunctive facet counts for the sidebar - ignore the facet selections but
  // apply the active search and org scope, matching the list.
  const countsQuery = useQuery<{
    status: Record<string, number>;
    refunded: Record<string, number>;
  }>({
    queryKey: ["payouts", "counts", orgId, search],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (search) sp.set("search", search);
      const { data } = await axios.get(`/api/dashboard/payouts/counts?${sp.toString()}`);
      return data;
    },
  });
  const countsReady = countsQuery.isSuccess;
  const statusCounts = useMemo(() => countsQuery.data?.status ?? {}, [countsQuery.data]);
  const refundedCounts = useMemo(() => countsQuery.data?.refunded ?? {}, [countsQuery.data]);

  // Both facets are small fixed sets: every option stays visible (with a count,
  // including 0) so the filter set is stable.
  const FILTER_GROUPS: FilterGroup[] = useMemo(() => {
    const opt = (counts: Record<string, number>) => (value: string, label: string) =>
      countsReady ? { value, label, count: counts[value] ?? 0 } : { value, label };
    const statusOpt = opt(statusCounts);
    const refundedOpt = opt(refundedCounts);
    return [
      {
        type: "checkbox",
        key: "status",
        label: t("status"),
        options: [
          statusOpt("SUCCEEDED", t("paid")),
          statusOpt("PENDING", t("pendingPayout")),
          statusOpt("FAILED", t("failed")),
        ],
      },
      {
        type: "checkbox",
        key: "refunded",
        label: t("refund"),
        options: [
          refundedOpt("full", t("refunded")),
          refundedOpt("partial", t("partiallyRefunded")),
          refundedOpt("active", t("notRefunded")),
        ],
      },
    ];
  }, [t, countsReady, statusCounts, refundedCounts]);

  const filters: OrgPayoutFilters = {
    search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    status: params.status,
    refunded: params.refunded,
  };

  const filterValues: FilterValues = {
    status: params.status,
    refunded: params.refunded,
  };

  const handleFilterChange = (key: string, value: string[] | [number?, number?] | number | null) => {
    if (key === "status") setParams({ status: value as string[] });
    else if (key === "refunded") setParams({ refunded: value as string[] });
  };

  const handleFilterClear = () => setParams({ status: [], refunded: [] });

  const handleFilterRemove = (key: string, value?: string) => {
    if (!value) return;
    if (key === "status") {
      setParams({ status: params.status.filter((s) => s !== value) });
    } else if (key === "refunded") {
      setParams({ refunded: params.refunded.filter((s) => s !== value) });
    }
  };

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
          onSortByChange={(v) => setParams({ sortBy: v as OrgPayoutFilters["sortBy"] })}
          onSortOrderChange={(v) => setParams({ sortOrder: v })}
          sortOptions={SORT_OPTIONS}
          filterGroups={FILTER_GROUPS}
          filterValues={filterValues}
          onFilterChange={handleFilterChange}
          onFilterClear={handleFilterClear}
        />
        <ActiveFilters
          groups={FILTER_GROUPS}
          values={filterValues}
          onRemove={handleFilterRemove}
          onClearAll={handleFilterClear}
        />
        <OrgPayoutsList filters={filters} />
      </div>
    </div>
  );
}
