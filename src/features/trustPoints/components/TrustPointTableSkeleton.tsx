import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Trust-point table layout + loading state. `AdminTrustPointsPage.tsx` imports
 * the template from here so the two can never describe different columns.
 *
 * 5 columns: label | icon | order | status | actions. The actions column fits
 * two 32px icon buttons plus the `pr-2.5` the house style puts after an icon
 * row (32 + 4 + 32 + 10 = 78, rounded to 80).
 */
export const TRUST_POINT_COLS = "minmax(140px,1fr) 110px 80px 110px 80px";

/**
 * One placeholder row. The tallest element is the icon-button group (h-8), so
 * a row is 32 + `p-3` = 56px - the same height the real row settles at.
 */
export function TrustPointSkeletonRow() {
  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 min-w-fit"
      style={{ gridTemplateColumns: TRUST_POINT_COLS }}
    >
      {/* Label is `font-medium` at the inherited 16px body size. */}
      <Skeleton className="h-4 w-36" />
      {/* Icon cell: the 16px glyph plus its name in `text-xs`. */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-3 w-14" />
      </div>
      <Skeleton className="h-3.5 w-6 ml-auto" />
      {/* Status is a <Badge>: 20px tall with its own rounded-md pill. */}
      <div className="flex justify-center">
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
      <div className="flex items-center justify-end gap-1">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Full surface placeholder: the search row above the table plus the table,
 * matching <AdminTrustPointsPage>'s `flex flex-col gap-4` wrapper.
 */
export function TrustPointTableSkeleton({ rows = 6 }: { rows?: number }) {
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
          style={{ gridTemplateColumns: TRUST_POINT_COLS }}
        >
          <HeaderCell className="w-12" />
          <HeaderCell className="w-10" />
          <HeaderCell className="w-12" align="end" />
          <HeaderCell className="w-12" align="center" />
          <HeaderCell className="w-12" align="end" cellClassName="pr-2.5" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <TrustPointSkeletonRow key={i} />
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
        align === "end" && "justify-end",
        align === "center" && "justify-center",
        cellClassName,
      )}
    >
      <Skeleton className={cn("h-3.5", className)} />
    </div>
  );
}
