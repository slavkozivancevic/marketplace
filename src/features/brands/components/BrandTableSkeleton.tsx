import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Brand table layout + loading state. `AdminBrandsPage.tsx` imports the
 * template from here so the two can never describe different columns.
 *
 * 6 columns: logo | name | slug | description | products | actions.
 */
export const BRAND_COLS = "48px minmax(120px,1fr) 140px minmax(120px,2fr) 80px 116px";

/**
 * One placeholder row. The tallest cell is the 40px <BrandLogo> (`rounded-sm`
 * square), so a row is 40 + `p-3` = 64px - taller than the 32px icon buttons
 * next to it.
 */
export function BrandSkeletonRow() {
  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 min-w-fit"
      style={{ gridTemplateColumns: BRAND_COLS }}
    >
      <Skeleton className="h-10 w-10 rounded-sm" />
      {/* Name is `font-medium` at the inherited 16px body size. */}
      <Skeleton className="h-4 w-32" />
      {/* Slug is `font-mono text-xs`. */}
      <Skeleton className="h-3 w-24" />
      {/* Description is `text-sm`. */}
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-8 ml-auto" />
      <div className="flex items-center justify-end gap-1">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Full brands surface placeholder: the search row above the table plus the
 * table itself, matching <AdminBrandsPage>'s `flex flex-col gap-4` wrapper.
 */
export function BrandTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Search row: <SearchInput> (h-8, rounded-lg, flex-1 max-w-sm) and a
          right-aligned `text-xs` result count. */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <Skeleton className="h-8 flex-1 min-w-0 max-w-sm rounded-lg" />
        <div className="flex h-4 items-center ml-auto">
          <Skeleton className="h-3 w-16" />
        </div>
      </div>

      <div
        role="table"
        className="rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]"
      >
        {/* Header: `text-sm` cells -> 44px tall (12 + 20 + 12). Note it has no
            `shrink-0` in the real table. */}
        <div
          role="row"
          className="grid items-center gap-4 border-b p-3 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit"
          style={{ gridTemplateColumns: BRAND_COLS }}
        >
          <HeaderCell className="w-8" />
          <HeaderCell className="w-12" />
          <HeaderCell className="w-10" />
          <HeaderCell className="w-16" />
          <HeaderCell className="w-14" align="end" />
          <HeaderCell className="w-12" align="end" cellClassName="pr-2.5" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <BrandSkeletonRow key={i} />
        ))}
      </div>
    </div>
  );
}

function HeaderCell({
  className,
  align = "start",
  cellClassName,
}: {
  className?: string;
  align?: "start" | "end";
  cellClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-5 items-center",
        align === "end" && "justify-end",
        cellClassName,
      )}
    >
      <Skeleton className={cn("h-3.5", className)} />
    </div>
  );
}
