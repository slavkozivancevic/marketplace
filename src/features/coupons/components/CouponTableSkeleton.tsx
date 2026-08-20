import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Coupon table layout + loading state. `CouponsView.tsx` imports the template
 * from here so a `loading.tsx` can render the same table without pulling the
 * interactive view (react-query, dialogs, server actions) into its chunk.
 *
 * 8 columns: code, discount, minOrder, usage, perUser, expires, status, actions.
 */
export const COUPON_COLS =
  "grid grid-cols-[minmax(120px,1.2fr)_minmax(90px,0.9fr)_minmax(100px,1fr)_minmax(130px,1.1fr)_minmax(100px,0.9fr)_minmax(110px,1fr)_minmax(90px,0.8fr)_120px] items-center gap-4";

/**
 * One placeholder row. The real row is `px-3 py-2.5` and its tallest cell is
 * the actions group - three `size="icon"` buttons (h-8) - so a row is
 * 10 + 32 + 10 = 52px.
 */
export function CouponSkeletonRow() {
  return (
    <div role="row" className={cn(COUPON_COLS, "border-b px-3 py-2.5 min-w-fit")}>
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-3.5 w-12" />
      <Skeleton className="h-3.5 w-16" />
      <Skeleton className="h-3.5 w-10" />
      <Skeleton className="h-3.5 w-8" />
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-5 w-16 rounded-4xl" />
      <div className="flex items-center justify-end gap-1">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

/** Full coupons table placeholder, header included. */
export function CouponTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div
      role="table"
      className="rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]"
    >
      <div
        role="row"
        // NOTE: the header is `p-3` while the rows are `px-3 py-2.5` - the two
        // genuinely differ in the real table, so don't "harmonise" them here.
        className={cn(
          COUPON_COLS,
          "border-b p-3 shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit",
        )}
      >
        <HeaderCell className="w-12" />
        <HeaderCell className="w-14" />
        <HeaderCell className="w-16" />
        <HeaderCell className="w-12" />
        <HeaderCell className="w-14" />
        <HeaderCell className="w-14" />
        <HeaderCell className="w-12" />
        <HeaderCell className="w-12" align="end" cellClassName="pr-2" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <CouponSkeletonRow key={i} />
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
