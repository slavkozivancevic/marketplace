import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Admin COD-balances table layout + loading state. `AdminCodBalances.tsx`
 * imports the template from here so the two can never describe different
 * columns.
 *
 * 4 columns: organization | currency | owed | actions. This route's query is
 * a live DB aggregate (not `"use cache"`), so it is the slowest of the
 * server-rendered admin tables and the one that most needs a placeholder.
 */
export const COD_BALANCES_COLS =
  "grid grid-cols-[minmax(160px,2fr)_100px_150px_140px] items-center gap-4";

/**
 * Full COD-balances table placeholder.
 *
 * Two details that differ from the other admin tables and must be kept: the
 * container has NO `[scrollbar-gutter:stable]`, and the sticky header has NO
 * `rounded-t-lg`.
 */
export function AdminCodBalancesSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-lg border flex-1 min-h-0 overflow-auto">
      <div
        role="row"
        className={cn(
          COD_BALANCES_COLS,
          "border-b p-3 sticky top-0 z-10 bg-background min-w-fit",
        )}
      >
        <HeaderCell className="w-20" />
        <HeaderCell className="w-14" />
        <HeaderCell className="w-10" align="end" />
        <HeaderCell className="w-12" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          role="row"
          className={cn(COD_BALANCES_COLS, "border-b p-3 min-w-fit")}
        >
          {/* Row cells are `text-sm`; the tallest is the `size="sm"` settle
              button (h-7), so a row is 28 + `p-3` = 52px. */}
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3.5 w-10" />
          <Skeleton className="h-3.5 w-20 ml-auto" />
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
  align?: "start" | "end";
}) {
  return (
    <div className={cn("flex h-5 items-center", align === "end" && "justify-end")}>
      <Skeleton className={cn("h-3.5", className)} />
    </div>
  );
}
