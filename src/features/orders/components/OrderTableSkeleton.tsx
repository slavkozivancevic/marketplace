import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Order table layouts + loading states for BOTH order lists, kept in one place
 * because they are near-identical and used to be served by a single shared
 * skeleton whose defaults silently belonged to the buyer table - the org list's
 * load-more sentinel rendered a 6-column, buyer-less row inside its 7-column
 * table.
 *
 * `OrdersList.tsx` (buyer) and `OrgOrdersList.tsx` (seller) import their
 * template from here.
 */

/** Buyer's own orders: id | date | time | items | total | status. */
export const ORDER_COLS =
  "grid-cols-[100px_100px_80px_minmax(200px,2fr)_120px_230px]";

/** Seller org orders: adds a buyer column between items and subtotal. */
export const ORG_ORDER_COLS =
  "grid-cols-[100px_100px_80px_minmax(180px,2fr)_140px_120px_230px]";

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

/**
 * One placeholder row. The tallest cell is the status <Badge> (h-5), so the row
 * is 20 + `p-3` = 44px, matching the real row.
 */
export function OrderSkeletonRow({
  cols = ORDER_COLS,
  withBuyer = false,
}: {
  cols?: string;
  withBuyer?: boolean;
} = {}) {
  return (
    <div
      role="row"
      className={cn("grid items-center gap-4 border-b p-3 min-w-fit", cols)}
    >
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-4 w-40" />
      {withBuyer && <Skeleton className="h-4 w-24" />}
      <Skeleton className="h-4 w-16 ml-auto" />
      <Skeleton className="h-5 w-20 rounded-4xl mx-auto" />
    </div>
  );
}

function OrderSkeletonHeader({
  cols,
  withBuyer,
}: {
  cols: string;
  withBuyer: boolean;
}) {
  return (
    <div
      role="row"
      className={cn(
        "grid items-center gap-4 border-b p-3 shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit",
        cols,
      )}
    >
      <HeaderCell className="w-14" />
      <HeaderCell className="w-10" />
      <HeaderCell className="w-8" />
      <HeaderCell className="w-12" />
      {withBuyer && <HeaderCell className="w-12" />}
      <HeaderCell className="w-12" align="end" />
      <HeaderCell className="w-12" align="center" />
    </div>
  );
}

/** Full buyer-orders table placeholder. */
export function OrderTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      role="table"
      className="rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]"
    >
      <OrderSkeletonHeader cols={ORDER_COLS} withBuyer={false} />
      {Array.from({ length: rows }, (_, i) => (
        <OrderSkeletonRow key={i} />
      ))}
    </div>
  );
}

/** Full seller-org-orders table placeholder. */
export function OrgOrderTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div
      role="table"
      className="rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]"
    >
      <OrderSkeletonHeader cols={ORG_ORDER_COLS} withBuyer />
      {Array.from({ length: rows }, (_, i) => (
        <OrderSkeletonRow key={i} cols={ORG_ORDER_COLS} withBuyer />
      ))}
    </div>
  );
}