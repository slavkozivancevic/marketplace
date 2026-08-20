import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Product table layout + its loading state, deliberately co-located.
 *
 * The grid template lives HERE and `ProductTable.tsx` imports it, so the real
 * header/row and the skeleton physically cannot describe different columns.
 * The previous arrangement (template in the table, a hand-copied duplicate in
 * `ui/skeleton.tsx`) drifted silently - nothing tells you to edit a generic UI
 * primitive when you add a column to a feature table.
 *
 * This module has no `"use client"` and no heavy imports on purpose: a
 * `loading.tsx` can render it as a plain server component without pulling the
 * whole interactive table (react-query, dialogs, server actions) into the
 * loading chunk.
 */

const COLS_BASE = "64px minmax(100px,1fr) 120px minmax(150px,2fr) 120px 100px";
const COLS_CREATED_BY = " 140px";
const COLS_ACTIONS = " 116px";

export function buildProductTableCols(
  showCreatedBy: boolean,
  showActions: boolean,
): string {
  return (
    COLS_BASE +
    (showCreatedBy ? COLS_CREATED_BY : "") +
    (showActions ? COLS_ACTIONS : "")
  );
}

type ProductTableSkeletonProps = {
  showActions?: boolean;
  showCreatedBy?: boolean;
};

/**
 * Header placeholder. Mirrors <ProductTableHeader>'s box exactly, including the
 * `p-3` padding and `bg-background rounded-t-lg sticky top-0 z-10`.
 *
 * The bars are wrapped in `flex h-5 items-center` rather than sized directly:
 * the real header cells hold `text-sm` text, whose 20px line box is what makes
 * the header 44px tall (12 + 20 + 12). A bare `h-3.5` bar would collapse the
 * row to 38px and shift the whole table up by 6px on hydration.
 */
export function ProductTableSkeletonHeader({
  showActions = false,
  showCreatedBy = false,
}: ProductTableSkeletonProps) {
  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit"
      style={{ gridTemplateColumns: buildProductTableCols(showCreatedBy, showActions) }}
    >
      <HeaderCell className="w-12" />
      <HeaderCell className="w-10" />
      <HeaderCell className="w-12" />
      <HeaderCell className="w-16" />
      <HeaderCell className="w-10" align="end" />
      <HeaderCell className="w-12" align="center" />
      {showCreatedBy && <HeaderCell className="w-16" />}
      {/* The real "Actions" header carries `pr-2.5` so its label lines up with
          the trash icon's visible edge - keep it or the bar sits 10px right. */}
      {showActions && <HeaderCell className="w-12" align="end" cellClassName="pr-2.5" />}
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

/**
 * Row placeholder. Height is driven by the 48px thumbnail exactly like the real
 * row (48 + `p-3` top/bottom = 72px), so a page of these is the same height as
 * a page of products.
 */
export function ProductTableSkeletonRow({
  showActions = false,
  showCreatedBy = false,
}: ProductTableSkeletonProps) {
  return (
    <div
      role="row"
      className="grid items-center gap-4 border-b p-3 min-w-fit"
      style={{ gridTemplateColumns: buildProductTableCols(showCreatedBy, showActions) }}
    >
      {/* Thumbnail - `rounded border` matches the real 48px media box. */}
      <Skeleton className="h-12 w-12 rounded border" />
      {/* Title - inherits the 16px body size in the real row, so h-4. */}
      <Skeleton className="h-4 w-3/4" />
      {/* Brand - 20px <BrandLogo> + a `text-sm` name. */}
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-3.5 w-16" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-16 ml-auto" />
      {/* <Badge> is h-5 / rounded-4xl. */}
      <Skeleton className="h-5 w-16 rounded-4xl mx-auto" />
      {showCreatedBy && <Skeleton className="h-3.5 w-20" />}
      {showActions && (
        // Three `size="icon"` buttons: size-8 (32px), rounded-lg, gap-1.
        <div className="flex items-center justify-end gap-1">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      )}
    </div>
  );
}

/** Full table placeholder - the scroll container, header and `rows` rows. */
export function ProductTableSkeleton({
  rows = 8,
  showActions = false,
  showCreatedBy = false,
}: ProductTableSkeletonProps & { rows?: number }) {
  return (
    <div
      role="table"
      className="rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]"
    >
      <ProductTableSkeletonHeader showActions={showActions} showCreatedBy={showCreatedBy} />
      {/* Rows are emitted as direct children (not via <SkeletonArray>, which
          adds a wrapper div) so the DOM matches the real list exactly. */}
      {Array.from({ length: rows }, (_, i) => (
        <ProductTableSkeletonRow
          key={i}
          showActions={showActions}
          showCreatedBy={showCreatedBy}
        />
      ))}
    </div>
  );
}