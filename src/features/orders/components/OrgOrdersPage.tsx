"use client";

import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { orgOrderSearchParams, type OrgOrderFilters } from "@/lib/query/searchParams";
import { SearchToolbar } from "@/components/search/SearchToolbar";
import { FilterSidebar, type FilterGroup, type FilterValues } from "@/components/search/FilterSidebar";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { OrgOrdersList } from "./OrgOrdersList";

export function OrgOrdersPage() {
  const t = useTranslations("orgOrders");

  const SORT_OPTIONS = [
    { value: "createdAt", label: t("date") },
    { value: "total", label: t("total") },
  ];

  const FILTER_GROUPS: FilterGroup[] = [
    {
      type: "checkbox",
      key: "status",
      label: t("status"),
      options: [
        { value: "PENDING_COD", label: t("pending_cod") },
        { value: "COMPLETED", label: t("completed") },
        { value: "CANCELLED", label: t("cancelled") },
        { value: "REFUNDED", label: t("refunded") },
      ],
    },
  ];

  const [params, setParams] = useQueryStates(orgOrderSearchParams, {
    shallow: false,
    throttleMs: 300,
  });

  const filters: OrgOrderFilters = {
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    status: params.status,
  };

  const filterValues: FilterValues = { status: params.status };

  const handleFilterChange = (key: string, value: string[] | [number?, number?]) => {
    if (key === "status") setParams({ status: value as string[] });
  };

  const handleFilterClear = () => setParams({ status: [] });

  const handleFilterRemove = (key: string, value?: string) => {
    if (key === "status" && value) {
      setParams({ status: params.status.filter((s) => s !== value) });
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
          search={params.search}
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
        <ActiveFilters
          groups={FILTER_GROUPS}
          values={filterValues}
          onRemove={handleFilterRemove}
          onClearAll={handleFilterClear}
        />
        <OrgOrdersList filters={filters} />
      </div>
    </div>
  );
}