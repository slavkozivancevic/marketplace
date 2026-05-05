"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
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

export function PublicProductsPage({
  brands = [],
  footer,
}: {
  brands?: BrandOption[];
  footer?: React.ReactNode;
}) {
  const t = useTranslations();

  const SORT_OPTIONS = [
    { value: "createdAt", label: t("products.dateAdded") },
    { value: "price", label: t("products.price") },
    { value: "title", label: t("products.name") },
    { value: "avgRating", label: t("products.rating") },
  ];

  const BASE_FILTER_GROUPS: FilterGroup[] = [
    {
      type: "range",
      key: "price",
      label: t("products.price"),
      prefix: "$",
      min: 0,
      step: 1,
    },
    {
      type: "checkbox",
      key: "onSale",
      label: t("products.deals"),
      options: [{ value: "true", label: t("products.onSale") }],
    },
    {
      type: "checkbox",
      key: "isDigital",
      label: t("products.productType"),
      options: [
        { value: "false", label: t("products.physical") },
        { value: "true", label: t("products.digital") },
      ],
    },
  ];
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
        label: t("products.brand"),
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
    brandId: params.brandId,
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
      setParams({ brandId: vals });
    }
  };

  const handleFilterClear = () => {
    setParams({ minPrice: null, maxPrice: null, onSale: null, isDigital: null, brandId: [] });
  };

  const handleFilterRemove = (key: string) => {
    if (key === "price") setParams({ minPrice: null, maxPrice: null });
    else if (key === "onSale") setParams({ onSale: null });
    else if (key === "isDigital") setParams({ isDigital: null });
    else if (key === "brandId") setParams({ brandId: [] });
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
          searchPlaceholder={t("products.searchPlaceholder")}
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
        <PublicProductsGrid filters={filters} />
        {/* footer */}
      </div>
    </div>
  );
}
