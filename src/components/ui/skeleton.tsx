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

export function SkeletonProductCard() {
  return (
    <div className="space-y-6">
      {/* Basic info */}
      <div className="rounded-xl border bg-background p-6">
        <div className="mb-4">
          <SkeletonText rows={1} size="lg" className="w-48" />
        </div>

        <div className="space-y-4">
          <div>
            <SkeletonText rows={1} size="md" className="w-24" />
            <div className="mt-2">
              <SkeletonText rows={1} size="md" className="w-1/2" />
            </div>
          </div>

          <div>
            <SkeletonText rows={1} size="md" className="w-28" />
            <div className="mt-2">
              <SkeletonText rows={2} size="md" className="w-full" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <SkeletonText rows={1} size="md" className="w-20" />
              <div className="mt-2">
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>

            <div>
              <SkeletonText rows={1} size="md" className="w-16" />
              <div className="mt-2">
                <SkeletonText rows={1} size="md" className="w-20" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Images */}
      <div className="rounded-xl border bg-background p-6">
        <div className="mb-4">
          <SkeletonText rows={1} size="lg" className="w-24" />
        </div>

        <div className="flex flex-wrap gap-4">
          <SkeletonArray amount={4}>
            <Skeleton className="h-32 w-32 rounded-lg" />
          </SkeletonArray>
        </div>
      </div>

      {/* Variants */}
      <div className="rounded-xl border bg-background p-6">
        <div className="mb-4">
          <SkeletonText rows={1} size="lg" className="w-24" />
        </div>

        <div className="space-y-3">
          <SkeletonArray amount={3}>
            <div className="rounded-lg border p-4">
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
