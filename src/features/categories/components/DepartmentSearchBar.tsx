"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlignLeft, ChevronDown, Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SortSelect, type SortOption } from "@/components/search/SortSelect";
import {
  MobileFilterSheet,
  type FilterGroup,
  type FilterValues,
} from "@/components/search/FilterSidebar";
import { DepartmentDrawer } from "./DepartmentDrawer";
import type { CategoryTreeItem } from "../db/categories";
import { getCategoryName } from "../utils/translations";
import { useLocale } from "next-intl";
import { useDebounce } from "@/hooks/useDebounce";

interface DepartmentSearchBarProps {
  /** Full category tree passed from server. */
  tree: CategoryTreeItem[];
  /** Currently selected dept slug ("" = All). */
  dept: string;
  onDeptChange: (slug: string) => void;

  search: string;
  onSearchChange: (value: string) => void;

  sortBy: string;
  sortOrder: "asc" | "desc";
  onSortByChange: (value: string) => void;
  onSortOrderChange: (value: "asc" | "desc") => void;
  sortOptions: SortOption[];

  filterGroups?: FilterGroup[];
  filterValues?: FilterValues;
  onFilterChange?: (
    key: string,
    value: string[] | [number?, number?] | number | null,
  ) => void;
  onFilterClear?: () => void;

  isPending?: boolean;
}

function nodeMatchesSlug(node: CategoryTreeItem, slug: string): boolean {
  // Match against any locale's slug so a "dept=..." param works regardless of
  // the language the URL was generated in.
  return node.translations.some((tr) => tr.slug === slug);
}

function findDeptNode(tree: CategoryTreeItem[], slug: string): CategoryTreeItem | null {
  for (const node of tree) {
    if (nodeMatchesSlug(node, slug)) return node;
    const found = findDeptNode(node.children, slug);
    if (found) return found;
  }
  return null;
}

export function DepartmentSearchBar({
  tree,
  dept,
  onDeptChange,
  search,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortByChange,
  onSortOrderChange,
  sortOptions,
  filterGroups,
  filterValues,
  onFilterChange,
  onFilterClear,
  isPending,
}: DepartmentSearchBarProps) {
  const t = useTranslations("categories");
  const tSearch = useTranslations("search");
  const locale = useLocale();

  const [drawerOpen, setDrawerOpen] = useState(false);

  // Local input state - debounced before propagating up
  const [localSearch, setLocalSearch] = useState(search);
  const debounced = useDebounce(localSearch, 300);

  // Propagate debounced value to parent
  useEffect(() => {
    if (debounced !== search) onSearchChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // If the parent clears search externally (e.g. dept change), sync local
  useEffect(() => {
    if (search === "" && localSearch !== "") setLocalSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function clearSearch() {
    setLocalSearch("");
    onSearchChange("");
  }

  const deptNode = dept ? findDeptNode(tree, dept) : null;
  const deptName = deptNode ? getCategoryName(deptNode, locale) : null;
  const deptLabel = deptName ?? t("allDepartments");
  const hasDepts = tree.length > 0;

  const activeFilterCount = filterValues
    ? Object.entries(filterValues).filter(([, v]) => {
        if (Array.isArray(v)) return v.some((item) => item != null);
        return v != null;
      }).length
    : 0;

  const isPendingSearch = isPending || localSearch !== debounced;

  return (
    <>
      {/* Row 1: [dept + search input] + MobileFilterSheet + SortSelect.
          flex-wrap is a safety net (matches every other toolbar in the app) -
          on any width where everything already fits on one line this is a
          no-op; it only kicks in if the row ever gets too tight to hold all
          three pieces at once. */}
      <div className="flex flex-wrap items-stretch gap-2">
        <div className="h-8 flex-1 min-w-40 max-w-lg flex items-stretch gap-0 rounded-lg border border-border bg-background shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition-all">

          {/* Department selector */}
          {hasDepts && (
            <button
              onClick={() => setDrawerOpen(true)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 px-3 text-sm font-medium whitespace-nowrap shrink-0 border-r border-border hover:bg-muted transition-colors",
                dept ? "text-primary" : "text-foreground",
              )}
              aria-label={t("selectDepartment")}
            >
              <AlignLeft className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline max-w-35 truncate">{deptLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </button>
          )}

          {/* Search input */}
          <div className="relative flex-1 flex items-center min-w-0">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none shrink-0" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder={
                deptName
                  ? `${tSearch("searchIn")} ${deptName}...`
                  : tSearch("searchAllProducts")
              }
              className="w-full h-full bg-transparent pl-9 pr-8 text-sm outline-none placeholder:text-muted-foreground text-ellipsis"
            />
            {isPendingSearch ? (
              <Loader2 className="absolute right-3 h-4 w-4 text-muted-foreground animate-spin pointer-events-none" />
            ) : localSearch ? (
              <button
                onClick={clearSearch}
                className="absolute right-3 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Mobile filter button - isti red, pre sort */}
        {filterGroups && filterValues && onFilterChange && onFilterClear && (
          <MobileFilterSheet
            groups={filterGroups}
            values={filterValues}
            onChange={onFilterChange}
            onClear={onFilterClear}
            activeCount={activeFilterCount}
            className="h-8"
          />
        )}

        {/* Sort - desno od search bara */}
        <SortSelect
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortByChange={onSortByChange}
          onSortOrderChange={onSortOrderChange}
          options={sortOptions}
          triggerClassName="h-8 max-w-28 overflow-hidden sm:max-w-none"
        />
      </div>

      {/* Drawer */}
      <DepartmentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tree={tree}
        selectedDept={dept}
        // Dept change navigates to a clean URL, so search resets on its own -
        // calling the nuqs-backed clearSearch here would race the navigation.
        onChange={onDeptChange}
      />
    </>
  );
}