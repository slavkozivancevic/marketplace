import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { TableScroll } from "@/components/ui/table-scroll";

/**
 * Market table layout + loading state. `AdminPriceMarketsPage.tsx` imports the
 * template from here so the two can never describe different columns.
 *
 * 4 columns: name (with the default badge) | countries | rules | actions. No
 * status column: a market is never inactive. The actions column fits three
 * 32px icon buttons (edit, duplicate, delete), the same 116px as tags and
 * brands.
 */
export const PRICE_MARKET_COLS = "minmax(180px,1fr) minmax(160px,2fr) 80px 116px";

export function PriceMarketSkeletonRow() {
  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 min-w-fit"
      style={{ gridTemplateColumns: PRICE_MARKET_COLS }}
    >
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-44" />
      <Skeleton className="h-3.5 w-6 ml-auto" />
      <div className="flex items-center justify-end gap-1">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

/** Full surface placeholder: the search row plus the table. */
export function PriceMarketTableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <Skeleton className="h-8 flex-1 min-w-0 max-w-sm rounded-lg" />
        <div className="flex h-4 items-center ml-auto">
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <TableScroll>
        <div
          role="row"
          className="grid items-center gap-4 border-b p-3 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit"
          style={{ gridTemplateColumns: PRICE_MARKET_COLS }}
        >
          <HeaderCell className="w-12" />
          <HeaderCell className="w-16" />
          <HeaderCell className="w-10" align="end" />
          <HeaderCell className="w-12" align="end" cellClassName="pr-2.5" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <PriceMarketSkeletonRow key={i} />
        ))}
      </TableScroll>
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
