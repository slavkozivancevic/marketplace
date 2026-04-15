"use client";

import { useQueryStates } from "nuqs";
import {
  productSearchParams,
  type ProductFilters,
} from "@/lib/query/searchParams";
import { SearchToolbar } from "@/components/search/SearchToolbar";
import {
  FilterSidebar,
  type FilterGroup,
  type FilterValues,
} from "@/components/search/FilterSidebar";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { PublicProductsGrid } from "./PublicProductsGrid";

const SORT_OPTIONS = [
  { value: "createdAt", label: "Date Added" },
  { value: "price", label: "Price" },
  { value: "title", label: "Name" },
  { value: "avgRating", label: "Rating" },
];

const FILTER_GROUPS: FilterGroup[] = [
  {
    type: "range",
    key: "price",
    label: "Price",
    prefix: "$",
    min: 0,
    step: 1,
  },
];

export function PublicProductsPage() {
  const [params, setParams] = useQueryStates(productSearchParams, {
    shallow: false,
    throttleMs: 300,
  });

  const filters: ProductFilters = {
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
  };

  const filterValues: FilterValues = {
    price: [params.minPrice ?? undefined, params.maxPrice ?? undefined],
  };

  const handleFilterChange = (
    key: string,
    value: string[] | [number?, number?],
  ) => {
    if (key === "price") {
      const [min, max] = value as [number?, number?];
      setParams({ minPrice: min ?? null, maxPrice: max ?? null });
    }
  };

  const handleFilterClear = () => {
    setParams({ minPrice: null, maxPrice: null });
  };

  const handleFilterRemove = (key: string) => {
    if (key === "price") {
      setParams({ minPrice: null, maxPrice: null });
    }
  };

  return (
    <div className="flex gap-6">
      <FilterSidebar
        groups={FILTER_GROUPS}
        values={filterValues}
        onChange={handleFilterChange}
        onClear={handleFilterClear}
      />
      <div className="flex-1 min-w-0 space-y-4">
        <SearchToolbar
          search={params.search}
          onSearchChange={(v) => setParams({ search: v })}
          searchPlaceholder="Search products..."
          isPending={false}
          sortBy={params.sortBy}
          sortOrder={params.sortOrder}
          onSortByChange={(v) =>
            setParams({ sortBy: v as ProductFilters["sortBy"] })
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
        <PublicProductsGrid filters={filters} />
      </div>
    </div>
  );
}
