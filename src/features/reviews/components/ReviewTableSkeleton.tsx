import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Review moderation table layout + loading state. `ReviewsView.tsx` imports the
 * template from here so a `loading.tsx` can render the same table without
 * pulling the interactive view into its chunk.
 *
 * 7 columns: product, author, rating, comment, status, date, actions.
 */
export const REVIEW_COLS =
  "grid grid-cols-[minmax(140px,1.3fr)_minmax(110px,1fr)_110px_minmax(180px,2fr)_110px_140px_110px] items-center gap-4";

/**
 * One placeholder row. The real row is `px-3 py-2.5`; its tallest cell is the
 * actions group - two `size="icon"` buttons (h-8) - so a row is 52px.
 */
export function ReviewSkeletonRow() {
  return (
    <div role="row" className={cn(REVIEW_COLS, "border-b px-3 py-2.5 min-w-fit")}>
      <Skeleton className="h-3.5 w-32" />
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-3.5 w-40" />
      <Skeleton className="h-5 w-16 rounded-4xl mx-auto" />
      <Skeleton className="h-3.5 w-20" />
      <div className="flex items-center justify-end gap-1">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

/** Full reviews table placeholder, header included. */
export function ReviewTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div
      role="table"
      className="rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]"
    >
      {/* Header is `p-3` (rows are `px-3 py-2.5`) - they really do differ. */}
      <div
        role="row"
        className={cn(
          REVIEW_COLS,
          "border-b p-3 shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit",
        )}
      >
        <HeaderCell className="w-16" />
        <HeaderCell className="w-12" />
        <HeaderCell className="w-12" />
        <HeaderCell className="w-16" />
        <HeaderCell className="w-12" align="center" />
        <HeaderCell className="w-10" />
        <HeaderCell className="w-12" align="end" cellClassName="pr-2" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <ReviewSkeletonRow key={i} />
      ))}
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
      <Skeleton className={cn("h-3.5", className)} />
    </div>
  );
}
