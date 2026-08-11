"use client";

import { SearchInput } from "./SearchInput";
import { SortSelect, type SortOption } from "./SortSelect";
import { MobileFilterSheet, type FilterGroup, type FilterValues } from "./FilterSidebar";

interface SearchToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  isPending?: boolean;

  sortBy: string;
  sortOrder: "asc" | "desc";
  onSortByChange: (value: string) => void;
  onSortOrderChange: (value: "asc" | "desc") => void;
  sortOptions: SortOption[];

  filterGroups?: FilterGroup[];
  filterValues?: FilterValues;
  onFilterChange?: (key: string, value: string[] | [number?, number?] | number | null) => void;
  onFilterClear?: () => void;

  resultCount?: number;
}

export function SearchToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  isPending,
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
  sortOptions,
  filterGroups,
  filterValues,
  onFilterChange,
  onFilterClear,
  resultCount,
}: SearchToolbarProps) {
  const activeFilterCount = filterValues
    ? Object.entries(filterValues).filter(([, v]) => {
        if (Array.isArray(v)) return v.some((item) => item != null);
        return v != null;
      }).length
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          isPending={isPending}
          className="min-w-40"
        />
        <div className="flex items-center gap-2">
          {filterGroups &&
            filterValues &&
            onFilterChange &&
            onFilterClear && (
              <MobileFilterSheet
                groups={filterGroups}
                values={filterValues}
                onChange={onFilterChange}
                onClear={onFilterClear}
                activeCount={activeFilterCount}
              />
            )}
          <SortSelect
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortByChange={onSortByChange}
            onSortOrderChange={onSortOrderChange}
            options={sortOptions}
            triggerClassName="max-w-28 sm:max-w-none"
          />
        </div>
        {resultCount != null && (
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            {resultCount.toLocaleString()} result{resultCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}