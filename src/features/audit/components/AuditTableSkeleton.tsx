import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Audit log table layout + loading state. `AuditLogView.tsx` imports the
 * template from here so a `loading.tsx` can render the same table without
 * pulling the interactive view into its chunk.
 *
 * 6 columns: date, time, actor, action, entity, details.
 */
export const AUDIT_COLS =
  "grid grid-cols-[100px_80px_minmax(160px,1.2fr)_minmax(230px,1.3fr)_minmax(150px,1fr)_minmax(180px,2fr)] gap-4";

/**
 * One placeholder row. The real row is `items-start px-3 py-2.5 text-sm` and
 * its tallest cell is the action <Badge> (h-5), so a single-line row is
 * 10 + 20 + 10 = 40px. `items-start` matters: the details column can wrap to
 * several lines and the other cells must stay pinned to the top.
 */
export function AuditSkeletonRow() {
  return (
    <div role="row" className={cn(AUDIT_COLS, "items-start border-b px-3 py-2.5 min-w-fit")}>
      {/* Date/time cells are `text-xs`, so their bars sit in a 16px line box. */}
      <div className="flex h-4 items-center">
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex h-4 items-center">
        <Skeleton className="h-3 w-14" />
      </div>
      <div className="flex h-5 items-center">
        <Skeleton className="h-3.5 w-36" />
      </div>
      <Skeleton className="h-5 w-32 rounded-4xl" />
      <div className="flex h-5 items-center">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex h-5 items-center">
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  );
}

/** Full audit table placeholder, header included. */
export function AuditTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div
      role="table"
      className="rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]"
    >
      {/* Header is `items-center p-3` (rows are `items-start px-3 py-2.5`). */}
      <div
        role="row"
        className={cn(
          AUDIT_COLS,
          "items-center border-b p-3 shrink-0 bg-background rounded-t-lg sticky top-0 z-10 min-w-fit",
        )}
      >
        <HeaderCell className="w-10" />
        <HeaderCell className="w-8" />
        <HeaderCell className="w-12" />
        <HeaderCell className="w-14" />
        <HeaderCell className="w-12" />
        <HeaderCell className="w-14" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <AuditSkeletonRow key={i} />
      ))}
    </div>
  );
}

function HeaderCell({ className }: { className?: string }) {
  return (
    <div className="flex h-5 items-center">
      <Skeleton className={cn("h-3.5", className)} />
    </div>
  );
}
