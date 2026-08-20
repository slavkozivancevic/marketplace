import type { ReactNode } from "react";
import {
  SkeletonActiveFiltersSpacer,
  SkeletonFilterSidebar,
  SkeletonSearchToolbar,
} from "@/components/ui/skeleton";

/**
 * The shared body layout of every filterable list page - admin products,
 * my-products, buyer orders, org orders, payouts. All of them render exactly:
 *
 *   <div className="flex gap-6 flex-1 min-h-0">
 *     <FilterSidebar />
 *     <div className="flex-1 min-w-0 flex flex-col gap-4 min-h-0">
 *       <SearchToolbar />
 *       <ActiveFilters wrapper />   // collapsed to 0fr until a filter is set
 *       <List />
 *     </div>
 *   </div>
 *
 * Reproducing it in one place keeps every `loading.tsx` on the same geometry -
 * in particular the collapsed ActiveFilters box, which is invisible but still
 * eats a 16px flex gap, and is easy to forget when hand-writing a placeholder.
 *
 * Note the sidebar's option counts are a best guess: they come from live facet
 * data (which brands still have products, how many org members exist). That is
 * harmless - the sidebar is its own `overflow-y-auto` column, so being a row
 * out never moves the table next to it.
 */
export function FilterListPageSkeleton({
  groups,
  children,
}: {
  /** Filter groups in page order - see <SkeletonFilterSidebar>. */
  groups: (number | "range")[];
  /** The table (or grid) placeholder for this page. */
  children: ReactNode;
}) {
  return (
    <div className="flex gap-6 flex-1 min-h-0">
      <SkeletonFilterSidebar groups={groups} />
      <div className="flex-1 min-w-0 flex flex-col gap-4 min-h-0">
        <SkeletonSearchToolbar />
        <SkeletonActiveFiltersSpacer />
        {children}
      </div>
    </div>
  );
}
