"use client";

import { useQueryStates } from "nuqs";
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
  {
    type: "range",
    key: "price",
    label: "Price",
    prefix: "$",
    min: 0,
    step: 1,
  },
];

export function AdminProductsPage() {
  const [params, setParams] = useQueryStates(adminProductSearchParams, {
    shallow: false,
    throttleMs: 300,
  });

  const filters: AdminProductFilters = {
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    status: params.status,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
  };

  const filterValues: FilterValues = {
    status: params.status,
    price: [params.minPrice ?? undefined, params.maxPrice ?? undefined],
  };

  const handleFilterChange = (
    key: string,
    value: string[] | [number?, number?],
  ) => {
    if (key === "status") {
      setParams({ status: value as string[] });
    } else if (key === "price") {
      const [min, max] = value as [number?, number?];
      setParams({ minPrice: min ?? null, maxPrice: max ?? null });
    }
  };

  const handleFilterClear = () => {
    setParams({ status: [], minPrice: null, maxPrice: null });
  };

  const handleFilterRemove = (key: string, value?: string) => {
    if (key === "status" && value) {
      setParams({ status: params.status.filter((s) => s !== value) });
    } else if (key === "price") {
      setParams({ minPrice: null, maxPrice: null });
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
          searchPlaceholder="Search products..."
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortByChange={(v) =>
            setParams({ sortBy: v as AdminProductFilters["sortBy"] })
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
        <AdminProductsList filters={filters} />
      </div>
    </div>
  );
}
