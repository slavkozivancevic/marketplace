import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Attribute table layout + loading state. `AdminAttributesPage.tsx` imports the
 * template from here so the two can never describe different columns.
 *
 * 5 columns: label | key | type | usage | actions.
 */
export const ATTRIBUTE_COLS = "minmax(140px,1fr) 130px 80px 90px 116px";

/**
 * One placeholder row. The tallest element is the icon-button group (h-8), so
 * a row is 32 + `p-3` = 56px, matching the real row.
 */
export function AttributeSkeletonRow() {
  return (
    <div
      role="row"
      className="grid items-center gap-3 border-b p-3 min-w-fit"
      style={{ gridTemplateColumns: ATTRIBUTE_COLS }}
    >
      {/* Label is `font-medium` at the inherited 16px body size. */}
      <Skeleton className="h-4 w-36" />
      {/* Key is `font-mono text-xs`. */}
      <Skeleton className="h-3 w-20" />
      {/* Type is a centered <Badge>. */}
      <div className="flex justify-center">
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      {/* Usage is right-aligned `text-sm tabular-nums`. */}
      <Skeleton className="h-3.5 w-10 ml-auto" />
      <div className="flex items-center justify-end gap-1">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Full attributes surface placeholder: the search row above the table plus the
 * table, matching <AdminAttributesPage>'s `flex flex-col gap-4` wrapper.
 */
export function AttributeTableSkeleton({ rows = 8 }: { rows?: number }) {
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
          style={{ gridTemplateColumns: ATTRIBUTE_COLS }}
        >
          <HeaderCell className="w-12" />
          <HeaderCell className="w-8" />
          <HeaderCell className="w-10" align="center" />
          <HeaderCell className="w-12" align="end" />
          <HeaderCell className="w-12" align="end" cellClassName="pr-2.5" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <AttributeSkeletonRow key={i} />
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
