"use client";

import { useState, useEffect, useRef } from "react";
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

  // Local input state - debounced before propagating up, so a keystroke paints
  // immediately and only the settled value ever reaches the URL.
  const [localSearch, setLocalSearch] = useState(search);
  const debounced = useDebounce(localSearch, 300);

  // The value this input and the URL last agreed on. It is what tells an EDIT
  // apart from a MOUNT, and without it a mount can write the URL.
  //
  // During a client-side transition React renders the incoming page while the
  // search params still hold the OUTGOING URL's values, and the state that
  // render initialises is what gets committed. So arriving at the catalog from
  // a product page could mount this bar already holding the previous visit's
  // query. The old effect compared the debounced value against the committed
  // `search`, found them different, and pushed that dead query back into the
  // fresh page's URL: the catalog painted unfiltered, flashed the old filtered
  // result as the grid refetched, then undid itself a debounce later. Seeding
  // the ref from the same first render makes that mount a no-op.
  const settled = useRef(search);

  // "Someone typed in THIS instance since the last sync." `settled` alone is
  // not enough, because React keeps the outgoing page's subtree alive through a
  // route change WITHOUT running its effects, and flushes them all at once if
  // that subtree is ever shown again. A catalog left with "1000" in the box
  // therefore came back to life on the next visit and propagated that dead
  // query into a URL the buyer had just opened clean. A resurrected instance
  // has no edit to its name, so the flag keeps it quiet.
  const edited = useRef(false);

  // Propagate real edits upward - never the value we were born with, and never
  // one left over from a page the buyer has already walked away from.
  useEffect(() => {
    if (!edited.current) return;
    if (debounced === settled.current) return;
    edited.current = false;
    settled.current = debounced;
    onSearchChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // The URL is the source of truth, so adopt every change that comes from
  // outside this input: a cleared chip, a department change, browser back or
  // forward, or the commit that lands at the end of a navigation. Skipping the
  // echo of our own write is what keeps this from clobbering text that is
  // still being typed.
  useEffect(() => {
    if (search === settled.current) return;
    // The URL wins over a half-typed local edit - it is the state the rest of
    // the page (grid, facets, chips) is already rendering.
    edited.current = false;
    settled.current = search;
    setLocalSearch(search);
  }, [search]);

  function clearSearch() {
    setLocalSearch("");
    edited.current = false;
    settled.current = "";
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
              onChange={(e) => {
                edited.current = true;
                setLocalSearch(e.target.value);
              }}
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