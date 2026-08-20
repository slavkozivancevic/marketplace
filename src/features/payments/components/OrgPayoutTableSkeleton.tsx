import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Payout table layout + loading state.
 *
 * Status is 400px (not 180px) because it can hold up to three pills on one
 * line - refund state + COD-debt marker + paid/pending/failed. The old
 * hand-copied skeleton in `ui/skeleton.tsx` still had the retired 180px value,
 * which shortened the placeholder row inside this horizontally scrolling table
 * and put the status bar in the wrong place. `OrgPayoutTableRow.tsx` now
 * imports the template from here.
 */
export const PAYOUT_COL =
  "grid-cols-[minmax(120px,1fr)_120px_90px_150px_400px]";

/**
 * One placeholder row. `h-14` matches OrgPayoutTableRow's FIXED height - rows
 * stay even whether or not a payout shows its second refund/COD line - and the
 * real row uses `px-3` (not `p-3`) because of that fixed height.
 */
export function OrgPayoutSkeletonRow() {
  return (
    <div
      role="row"
      className={cn("grid items-center gap-4 border-b h-14 px-3 min-w-fit", PAYOUT_COL)}
    >
      {/* Order id is `font-mono text-xs`. */}
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-3.5 w-12" />
      <Skeleton className="h-3.5 w-16 ml-auto" />
      <Skeleton className="h-5 w-20 rounded-4xl mx-auto" />
    </div>
  );
}

/** Full payouts table placeholder. */
export function OrgPayoutTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      role="table"
      className="rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]"
    >
      <div
        role="row"
        className={cn(
          "grid items-center gap-4 border-b p-3 shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit",
          PAYOUT_COL,
        )}
      >
        <HeaderCell className="w-12" />
        <HeaderCell className="w-10" />
        <HeaderCell className="w-8" />
        <HeaderCell className="w-12" align="end" />
        <HeaderCell className="w-12" align="center" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <OrgPayoutSkeletonRow key={i} />
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