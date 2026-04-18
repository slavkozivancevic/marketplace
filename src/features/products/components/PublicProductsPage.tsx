"use client";

import { useMemo, useRef } from "react";
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
import type { BrandOption } from "@/features/brands/components/BrandSelect";

const SORT_OPTIONS = [
  { value: "createdAt", label: "Date Added" },
  { value: "price", label: "Price" },
  { value: "title", label: "Name" },
  { value: "avgRating", label: "Rating" },
];

const BASE_FILTER_GROUPS: FilterGroup[] = [
  {
    type: "range",
    key: "price",
    label: "Price",
    prefix: "$",
    min: 0,
    step: 1,
  },
  {
    type: "checkbox",
    key: "onSale",
    label: "Deals",
    options: [{ value: "true", label: "On Sale" }],
  },
  {
    type: "checkbox",
    key: "isDigital",
    label: "Product Type",
    options: [
      { value: "false", label: "Physical" },
      { value: "true", label: "Digital" },
    ],
  },
];

export function PublicProductsPage({
  brands = [],
  footer,
}: {
  brands?: BrandOption[];
  footer?: React.ReactNode;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [params, setParams] = useQueryStates(productSearchParams, {
    shallow: false,
    throttleMs: 300,
  });

  const filterGroups: FilterGroup[] = useMemo(() => {
    if (brands.length === 0) return BASE_FILTER_GROUPS;
    return [
      ...BASE_FILTER_GROUPS,
      {
        type: "checkbox" as const,
        key: "brandId",
        label: "Brand",
        options: brands.map((b) => ({ value: b.id, label: b.name })),
      },
    ];
  }, [brands]);

  const filters: ProductFilters = {
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    onSale: params.onSale,
    isDigital: params.isDigital,
    brandId: params.brandId,
  };

  const filterValues: FilterValues = {
    price: [params.minPrice ?? undefined, params.maxPrice ?? undefined],
    onSale: params.onSale === true ? ["true"] : [],
    isDigital: params.isDigital != null ? [String(params.isDigital)] : [],
    brandId: params.brandId != null ? [params.brandId] : [],
  };

  const handleFilterChange = (
    key: string,
    value: string[] | [number?, number?],
  ) => {
    if (key === "price") {
      const [min, max] = value as [number?, number?];
      setParams({ minPrice: min ?? null, maxPrice: max ?? null });
    } else if (key === "onSale") {
      const vals = value as string[];
      setParams({ onSale: vals.includes("true") ? true : null });
    } else if (key === "isDigital") {
      const vals = value as string[];
      if (vals.length === 0 || vals.length === 2) {
        setParams({ isDigital: null });
      } else {
        setParams({ isDigital: vals[0] === "true" });
      }
    } else if (key === "brandId") {
      const vals = value as string[];
      setParams({ brandId: vals[0] ?? null });
    }
  };

  const handleFilterClear = () => {
    setParams({ minPrice: null, maxPrice: null, onSale: null, isDigital: null, brandId: null });
  };

  const handleFilterRemove = (key: string) => {
    if (key === "price") setParams({ minPrice: null, maxPrice: null });
    else if (key === "onSale") setParams({ onSale: null });
    else if (key === "isDigital") setParams({ isDigital: null });
    else if (key === "brandId") setParams({ brandId: null });
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
        <div ref={scrollContainerRef} className="flex-1 min-h-0 overflow-y-auto">
          <PublicProductsGrid filters={filters} scrollContainerRef={scrollContainerRef} />
          {footer}
        </div>
      </div>
    </div>
  );
}
