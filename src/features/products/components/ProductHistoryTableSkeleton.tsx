import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Product history table layout + loading state. As with the product table, the
 * grid template lives here and `ProductHistoryTable.tsx` imports it - the old
 * hand-copied duplicate in `ui/skeleton.tsx` had fallen a whole column behind
 * (the single `createdAt` column was split into date + time), so every cell
 * from `updatedBy` rightwards rendered under the wrong header.
 *
 * 10 columns: version, "current" badge, title, description, price, status,
 * updatedBy, date, time, rollback button.
 */
export const HISTORY_COLS =
  "grid-cols-[60px_64px_minmax(140px,1fr)_minmax(200px,2fr)_120px_100px_minmax(120px,1fr)_100px_80px_100px]";

export function ProductHistoryTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      role="table"
      className="rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]"
    >
      {/* Header - `text-sm` cells make the real header 44px (12 + 20 + 12), so
          the bars sit inside a 20px line box instead of setting the height. */}
      <div
        role="row"
        className={cn(
          "grid items-center gap-2 border-b p-3 shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit",
          HISTORY_COLS,
        )}
      >
        <HeaderCell className="w-12" />
        {/* The real "current" header holds an `invisible` <Badge> purely to
            reserve width - no bar here, or the skeleton shows something that
            never appears. */}
        <div className="h-5" />
        <HeaderCell className="w-10" />
        <HeaderCell className="w-16" />
        <HeaderCell className="w-10" align="end" />
        <HeaderCell className="w-12" align="center" />
        <HeaderCell className="w-16" />
        <HeaderCell className="w-10" />
        <HeaderCell className="w-8" />
        <HeaderCell className="w-12" />
      </div>

      {/* Rows. Tallest cell is the `size="sm"` rollback button (h-7), so a row
          is 28 + 12 + 12 = 52px. */}
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          role="row"
          className={cn("grid items-center gap-2 border-b p-3 min-w-fit", HISTORY_COLS)}
        >
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-5 w-14 rounded-4xl mx-auto" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-14 ml-auto" />
          <Skeleton className="h-5 w-16 rounded-4xl mx-auto" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-7 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function HeaderCell({
  className,
  align = "start",
}: {
  className?: string;
  align?: "start" | "center" | "end";
}) {
  return (
    <div
      className={cn(
        "flex h-5 items-center",
        align === "center" && "justify-center",
        align === "end" && "justify-end",
      )}
    >
      <Skeleton className={cn("h-3.5", className)} />
    </div>
  );
}