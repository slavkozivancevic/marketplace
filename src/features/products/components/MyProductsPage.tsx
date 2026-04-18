"use client";

import { useQueryStates } from "nuqs";
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
import { MyProductsGrid } from "./MyProductsGrid";

const SORT_OPTIONS = [
  { value: "createdAt", label: "Date Added" },
  { value: "price", label: "Price" },
  { value: "title", label: "Name" },
  { value: "status", label: "Status" },
];

const FILTER_GROUPS: FilterGroup[] = [
  {
    type: "checkbox",
    key: "status",
    label: "Status",
    options: [
      { value: "DRAFT", label: "Draft" },
      { value: "PUBLISHED", label: "Published" },
      { value: "ARCHIVED", label: "Archived" },
    ],
  },
];

export function MyProductsPage({ canWrite }: { canWrite: boolean }) {
  const [params, setParams] = useQueryStates(myProductSearchParams, {
    shallow: false,
    throttleMs: 300,
  });

  const filters: MyProductFilters = {
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    status: params.status,
  };

  const filterValues: FilterValues = {
    status: params.status,
  };

  const handleFilterChange = (
    key: string,
    value: string[] | [number?, number?],
  ) => {
    if (key === "status") {
      setParams({ status: value as string[] });
    }
  };

  const handleFilterClear = () => {
    setParams({ status: [] });
  };

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
          searchPlaceholder="Search your products..."
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortByChange={(v) =>
            setParams({ sortBy: v as MyProductFilters["sortBy"] })
          }
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
        <MyProductsGrid canWrite={canWrite} filters={filters} />
      </div>
    </div>
  );
}
