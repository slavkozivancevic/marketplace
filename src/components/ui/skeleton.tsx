import { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { buttonVariants } from "./button";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export function SkeletonButton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        buttonVariants({
          variant: "secondary",
          className: "pointer-events-none w-24 animate-pulse",
        }),
        className,
      )}
    />
  );
}

export function SkeletonArray({
  amount,
  children,
}: {
  amount: number;
  children: ReactNode;
}) {
  return (
    <>
      {Array.from({ length: amount }, (_, i) => (
        <div key={i}>{children}</div>
      ))}
    </>
  );
}

export function SkeletonText({
  rows = 1,
  size = "md",
  className,
}: {
  rows?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <SkeletonArray amount={rows}>
        <div
          className={cn(
            "w-full animate-pulse rounded-sm bg-secondary",
            rows > 1 && "last:w-3/4",
            size === "sm" && "h-2.5",
            size === "md" && "h-3",
            size === "lg" && "h-5",
            className,
          )}
        />
      </SkeletonArray>
    </div>
  );
}

export function SkeletonSectionHeader({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <SkeletonText rows={1} size="lg" className="w-40" />
      <SkeletonText rows={1} size="md" className="w-72" />
    </div>
  );
}

export function SkeletonProductTable({
  rows = 5,
  showActions = false,
}: {
  rows?: number;
  showActions?: boolean;
}) {
  const columns = showActions
    ? "grid-cols-[2fr_3fr_1fr_1fr_1fr]"
    : "grid-cols-[2fr_3fr_1fr_1fr]";

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      {/* Header */}
      <div className={cn("grid gap-4 border-b p-4", columns)}>
        <SkeletonText rows={1} size="md" className="w-3/4" />
        <SkeletonText rows={1} size="md" className="w-full" />
        <SkeletonText rows={1} size="md" className="w-2/3" />
        <SkeletonText rows={1} size="md" className="w-2/3" />
        {showActions ? (
          <SkeletonText rows={1} size="md" className="w-1/2" />
        ) : null}
      </div>

      {/* Rows */}
      <div className="divide-y">
        <SkeletonArray amount={rows}>
          <div className={cn("grid gap-4 p-4", columns)}>
            <SkeletonText rows={1} size="md" className="w-3/4" />
            <SkeletonText rows={1} size="md" className="w-full" />
            <SkeletonText rows={1} size="md" className="w-2/3" />
            <SkeletonText rows={1} size="md" className="w-2/3" />
            {showActions ? <SkeletonButton className="w-20" /> : null}
          </div>
        </SkeletonArray>
      </div>
    </div>
  );
}

export function SkeletonHistoryTable({ rows = 5 }: { rows?: number }) {
  const columns = "grid-cols-[1fr_2fr_1fr_1.5fr_1fr]";

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      {/* Header */}
      <div className={cn("grid gap-4 border-b p-4", columns)}>
        <SkeletonText rows={1} size="md" className="w-1/2" /> {/* Version */}
        <SkeletonText rows={1} size="md" className="w-3/4" /> {/* Title */}
        <SkeletonText rows={1} size="md" className="w-1/2" /> {/* Updated By */}
        <SkeletonText rows={1} size="md" className="w-2/3" /> {/* Date */}
        <SkeletonText rows={1} size="md" className="w-1/4" /> {/* Actions */}
      </div>

      {/* Rows */}
      <div className="divide-y">
        <SkeletonArray amount={rows}>
          <div className={cn("grid gap-4 p-4", columns)}>
            <SkeletonText rows={1} size="md" className="w-1/2" />
            <SkeletonText rows={1} size="md" className="w-4/5" />
            <SkeletonText rows={1} size="md" className="w-1/2" />
            <SkeletonText rows={1} size="md" className="w-3/4" />
            <SkeletonButton className="w-20" />
          </div>
        </SkeletonArray>
      </div>
    </div>
  );
}

export function SkeletonProductGridCard() {
  return (
    <div className="border rounded-xl overflow-hidden h-full flex flex-col">
      <Skeleton className="w-full h-48 rounded-none shrink-0" />
      <div className="px-4 pt-3 pb-3 flex flex-col flex-1">
        <div className="flex-1 space-y-2">
          <SkeletonText rows={1} size="md" className="w-3/4" />
          <SkeletonText rows={2} size="sm" className="w-full" />
          <div className="flex items-center justify-between pt-1">
            <SkeletonText rows={1} size="md" className="w-16" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <SkeletonButton className="w-full mt-3" />
      </div>
    </div>
  );
}

export function SkeletonProductTableRow({
  showActions = false,
}: {
  showActions?: boolean;
}) {
  return (
    <div
      role="row"
      className="grid grid-cols-[64px_1fr_2fr_1fr_1fr_auto] items-center gap-4 border-b p-3"
    >
      <Skeleton className="h-12 w-12 rounded border" />
      <SkeletonText rows={1} size="md" className="w-3/4" />
      <SkeletonText rows={1} size="md" className="w-full" />
      <SkeletonText rows={1} size="md" className="w-1/2" />
      <Skeleton className="h-5 w-16 rounded-full" />
      {showActions ? <SkeletonButton className="w-24" /> : <span />}
    </div>
  );
}

export function SkeletonPayoutRow() {
  return (
    <div
      role="row"
      className="grid grid-cols-[minmax(120px,1fr)_120px_90px_150px_180px] items-center gap-4 border-b p-3"
    >
      <SkeletonText rows={1} size="md" className="w-24" />
      <SkeletonText rows={1} size="md" className="w-20" />
      <SkeletonText rows={1} size="md" className="w-12" />
      <SkeletonText rows={1} size="md" className="w-20 ml-auto" />
      <Skeleton className="h-5 w-20 rounded-full mx-auto" />
    </div>
  );
}

export function SkeletonOrderRow() {
  return (
    <div
      role="row"
      className="grid grid-cols-[1fr_1fr_1fr_2fr_1fr_1fr] items-center gap-4 border-b p-3"
    >
      <SkeletonText rows={1} size="md" className="w-20" />
      <SkeletonText rows={1} size="md" className="w-24" />
      <SkeletonText rows={1} size="md" className="w-16" />
      <SkeletonText rows={1} size="md" className="w-full" />
      <SkeletonText rows={1} size="md" className="w-12" />
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
  );
}

function SkeletonDetailsCard({
  titleWidth,
  rows,
}: {
  titleWidth: string;
  rows: number;
}) {
  return (
    <div className="rounded-xl border bg-background p-6">
      <div className="mb-4">
        <SkeletonText rows={1} size="lg" className={titleWidth} />
      </div>
      <div className="space-y-3">
        <SkeletonArray amount={rows}>
          <div className="flex gap-3">
            <SkeletonText rows={1} size="md" className="w-32 shrink-0" />
            <SkeletonText rows={1} size="md" className="w-1/2" />
          </div>
        </SkeletonArray>
      </div>
    </div>
  );
}

export function SkeletonProductCard() {
  return (
    <div className="space-y-6">
      {/* Basic info */}
      <div className="rounded-xl border bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <SkeletonText rows={1} size="lg" className="w-48" />
          <SkeletonButton className="w-28" />
        </div>

        <div className="space-y-3">
          <div className="flex gap-3">
            <SkeletonText rows={1} size="md" className="w-24 shrink-0" />
            <SkeletonText rows={1} size="md" className="w-1/2" />
          </div>
          <div className="flex gap-3">
            <SkeletonText rows={1} size="md" className="w-24 shrink-0" />
            <SkeletonText rows={1} size="md" className="w-1/3" />
          </div>
          <div className="flex gap-3">
            <SkeletonText rows={1} size="md" className="w-24 shrink-0" />
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>
          <div>
            <SkeletonText rows={1} size="md" className="w-28" />
            <div className="mt-2">
              <SkeletonText rows={2} size="md" className="w-full" />
            </div>
          </div>
          <div className="flex gap-3">
            <SkeletonText rows={1} size="md" className="w-24 shrink-0" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Images */}
      <div className="rounded-xl border bg-background p-6">
        <div className="mb-4">
          <SkeletonText rows={1} size="lg" className="w-24" />
        </div>
        <div className="space-y-3">
          <Skeleton className="w-full h-96 rounded-lg" />
          <div className="flex gap-2 flex-wrap">
            <SkeletonArray amount={5}>
              <Skeleton className="h-16 w-16 rounded border-2" />
            </SkeletonArray>
          </div>
        </div>
      </div>

      {/* Pricing & Inventory */}
      <SkeletonDetailsCard titleWidth="w-40" rows={4} />

      {/* Shipping */}
      <SkeletonDetailsCard titleWidth="w-28" rows={3} />

      {/* Variants */}
      <div className="rounded-xl border bg-background p-6">
        <div className="mb-4">
          <SkeletonText rows={1} size="lg" className="w-24" />
        </div>

        <div className="space-y-3">
          <SkeletonArray amount={3}>
            <div className="rounded-lg border p-4 bg-background">
              <SkeletonText rows={1} size="md" className="w-3/4" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            </div>
          </SkeletonArray>
        </div>
      </div>
    </div>
  );
}

export function SkeletonOrganizationCard({
  members = 3,
}: {
  members?: number;
}) {
  return (
    <div className="rounded-xl border bg-background p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <SkeletonText rows={1} size="lg" className="w-40" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <SkeletonButton className="w-20" />
      </div>
      <div className="space-y-2">
        <SkeletonText rows={1} size="md" className="w-24" />
        <div className="space-y-1.5">
          <SkeletonArray amount={members}>
            <div className="flex items-center justify-between">
              <SkeletonText rows={1} size="md" className="w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </SkeletonArray>
        </div>
      </div>
    </div>
  );
}

export function SkeletonUserRow() {
  return (
    <div className="border rounded-lg p-4 bg-background space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <SkeletonText rows={1} size="md" className="w-36" />
          <SkeletonText rows={1} size="sm" className="w-56" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-2">
          <SkeletonText rows={1} size="sm" className="w-12" />
          <Skeleton className="h-9 w-full max-w-xs rounded-md" />
        </div>
        <SkeletonButton className="w-28" />
      </div>
    </div>
  );
}

export function SkeletonFilteredListPage({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex gap-6 flex-1 min-h-0">
      {/* FilterSidebar (desktop only) */}
      <div className="hidden md:flex w-64 shrink-0 flex-col gap-4 rounded-xl border bg-background p-4">
        <SkeletonText rows={1} size="md" className="w-20" />
        <div className="space-y-2">
          <SkeletonArray amount={3}>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-sm" />
              <SkeletonText rows={1} size="md" className="w-24" />
            </div>
          </SkeletonArray>
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col min-h-0 gap-3">
        <div className="shrink-0 flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-full max-w-sm rounded-md" />
          <SkeletonText rows={1} size="sm" className="w-20 ml-auto" />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto pb-6">{children}</div>
      </div>
    </div>
  );
}

export function SkeletonProductForm() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* TabsList */}
      <div className="shrink-0 flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
      </div>

      {/* Active tab content (mirrors "Details" tab) */}
      <div className="flex-1 min-h-0 pt-6 space-y-6 overflow-hidden">
        {/* Title field */}
        <div className="space-y-2">
          <SkeletonText rows={1} size="md" className="w-16" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>

        {/* Slug field with refresh button */}
        <div className="space-y-2">
          <SkeletonText rows={1} size="md" className="w-12" />
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-md" />
          </div>
          <SkeletonText rows={1} size="sm" className="w-64" />
        </div>

        {/* Short description */}
        <div className="space-y-2">
          <SkeletonText rows={1} size="md" className="w-32" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>

        {/* Description (textarea) */}
        <div className="space-y-2">
          <SkeletonText rows={1} size="md" className="w-24" />
          <Skeleton className="h-30 w-full rounded-md" />
        </div>

        {/* Categories */}
        <div className="space-y-2">
          <SkeletonText rows={1} size="md" className="w-28" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>

        {/* Brand */}
        <div className="space-y-2">
          <SkeletonText rows={1} size="md" className="w-16" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>

        {/* Separator */}
        <div className="h-px bg-border" />

        {/* Images uploader */}
        <div className="space-y-2">
          <SkeletonText rows={1} size="md" className="w-20" />
          <Skeleton className="h-36 w-full rounded-md" />
        </div>
      </div>

      {/* Submit button */}
      <div className="shrink-0 pt-4 pb-6 border-t">
        <SkeletonButton className="w-32" />
      </div>
    </div>
  );
}
