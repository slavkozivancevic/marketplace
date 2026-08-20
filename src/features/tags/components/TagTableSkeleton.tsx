import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Tag table layout + loading state. `AdminTagsPage.tsx` imports the template
 * from here so the two can never describe different columns.
 *
 * 4 columns: name | slug | products | actions.
 */
export const TAG_COLS = "minmax(120px,1fr) 160px 90px 116px";

/**
 * One placeholder row. Unlike brands there is no logo cell, so the tallest
 * element is the icon-button group (h-8) - a row is 32 + `p-3` = 56px.
 */
export function TagSkeletonRow() {
  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 min-w-fit"
      style={{ gridTemplateColumns: TAG_COLS }}
    >
      {/* Name is `font-medium` at the inherited 16px body size. */}
      <Skeleton className="h-4 w-32" />
      {/* Slug is `font-mono text-xs`. */}
      <Skeleton className="h-3 w-24" />
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
 * Full tags surface placeholder: the search row above the table plus the table,
 * matching <AdminTagsPage>'s `flex flex-col gap-4` wrapper.
 */
export function TagTableSkeleton({ rows = 8 }: { rows?: number }) {
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
          className="grid items-center gap-4 border-b p-3 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit"
          style={{ gridTemplateColumns: TAG_COLS }}
        >
          <HeaderCell className="w-12" />
          <HeaderCell className="w-10" />
          <HeaderCell className="w-14" align="end" />
          <HeaderCell className="w-12" align="end" cellClassName="pr-2.5" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <TagSkeletonRow key={i} />
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
