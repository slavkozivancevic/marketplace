import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Category table layout + loading state. `AdminCategoriesPage.tsx` imports the
 * template from here so the two can never describe different columns.
 *
 * 5 columns: name | slug | products | status | actions.
 */
export const CATEGORY_COLS = "minmax(200px,1fr) 140px 90px 70px 116px";

/**
 * One placeholder row. `depth` reproduces the tree indent the real row applies
 * to its name cell, so the staggered left edge is there from the first paint
 * instead of appearing when the data lands.
 */
export function CategorySkeletonRow({ depth = 0 }: { depth?: number }) {
  return (
    <div
      role="row"
      className="grid items-center gap-3 border-b p-3 min-w-fit"
      style={{ gridTemplateColumns: CATEGORY_COLS }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div style={{ width: depth * 16 }} className="shrink-0" />
        <Skeleton className="h-4 w-40" />
      </div>
      {/* Slug is `font-mono text-xs`. */}
      <Skeleton className="h-3 w-24" />
      {/* Products count is right-aligned `text-sm tabular-nums`. */}
      <Skeleton className="h-3.5 w-8 ml-auto" />
      {/* Status is a centered <Badge>. */}
      <div className="flex justify-center">
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <div className="flex items-center justify-end gap-1">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Full categories surface placeholder: the search row above the table plus the
 * table, matching <AdminCategoriesPage>'s `flex flex-col gap-4` wrapper.
 *
 * The rows cycle root -> child -> child so the placeholder reads as the tree
 * the real list renders rather than a flat block.
 */
export function CategoryTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
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
        <div
          role="row"
          className="grid items-center gap-3 border-b p-3 bg-background sticky top-0 z-10 min-w-fit"
          style={{ gridTemplateColumns: CATEGORY_COLS }}
        >
          <HeaderCell className="w-12" />
          <HeaderCell className="w-10" />
          <HeaderCell className="w-14" align="end" />
          <HeaderCell className="w-12" align="center" />
          <HeaderCell className="w-12" align="end" cellClassName="pr-2.5" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <CategorySkeletonRow key={i} depth={i % 3 === 0 ? 0 : 1} />
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
  align?: "start" | "center" | "end";
  cellClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-5 items-center",
        align === "center" && "justify-center",
        align === "end" && "justify-end",
        cellClassName,
      )}
    >
      <Skeleton className={cn("h-3", className)} />
    </div>
  );
}
