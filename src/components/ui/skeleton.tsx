import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

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

/**
 * Mirrors <Button>'s own `size` variant so a skeleton action matches the real
 * button's height exactly (e.g. the org order detail page's `size="sm"` back
 * button is 28px tall, not the 32px default - a mismatched skeleton visibly
 * resizes on hydration).
 */
export function SkeletonButton({
  className,
  size = "default",
}: {
  className?: string;
  size?: "default" | "sm" | "xs" | "lg";
}) {
  return (
    <div
      className={cn(
        buttonVariants({
          variant: "secondary",
          size,
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

/**
 * Skeleton for the <Breadcrumbs> trail. Mirrors its exact box (`pt-2 pb-1`,
 * text-xs children -> 28px tall, not 32px) and its chevron-separated item
 * structure (real `<ChevronRight className="h-3 w-3" />` between crumbs), so
 * a loading.tsx trail doesn't shift height or look like a single bar when the
 * real multi-segment trail renders.
 */
export function SkeletonBreadcrumbs({
  className,
  segments = 2,
  widths = ["w-12", "w-24", "w-20", "w-32"],
}: {
  className?: string;
  /** Number of crumb items - match the real page's `breadcrumbItems.length`. */
  segments?: number;
  widths?: string[];
}) {
  // Padding and the row's fixed height must live on SEPARATE elements: this
  // box is border-box (Tailwind preflight), so a height class and padding on
  // the same div don't add - the padding eats into the fixed height instead,
  // undershooting the real nav's auto (content-driven) height.
  return (
    <div className={cn("pt-2 pb-1", className)}>
      <div className="flex h-4 items-center gap-1">
        {Array.from({ length: segments }, (_, i) => (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
            )}
            <Skeleton className={cn("h-3", widths[i % widths.length])} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for <PageHeader>. Reproduces its box classes verbatim - including
 * `sticky-header-bg` (so the nested-under-a-`sticky-header-bg`-wrapper CSS
 * rules zero this div's own padding-top/margin-bottom and hand the border +
 * paint to the outer wrapper exactly like the real header does) and its
 * responsive `pt-3 pb-3 sm:pt-6 sm:pb-4` / `text-xl sm:text-2xl` sizing - so a
 * loading.tsx that can't call the real PageHeader (dynamic title) still
 * matches it 1:1 at every breakpoint instead of only on desktop.
 */
export function SkeletonPageHeader({
  titleWidth = "w-56",
  descriptionWidth = "w-80",
  actions,
}: {
  titleWidth?: string;
  descriptionWidth?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 pt-3 pb-3 mb-2 sm:pt-6 sm:pb-4 sticky-header-bg will-change-transform">
      <div className="flex flex-col gap-2 sm:gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-0.5 min-w-0">
          <div className="flex h-7 items-center sm:h-8">
            <Skeleton className={cn("h-5 sm:h-6", titleWidth)} />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton className={cn("h-3.5", descriptionWidth)} />
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 md:shrink-0">{actions}</div>
        )}
      </div>
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

export function SkeletonHistoryTable({ rows = 8 }: { rows?: number }) {
  // Mirrors ProductHistoryTable's GRID_COLS (9 columns: version, current badge,
  // title, description, price, status, updatedBy, createdAt, rollback button).
  const cols =
    "grid-cols-[60px_64px_minmax(140px,1fr)_minmax(200px,2fr)_120px_100px_minmax(120px,1fr)_minmax(180px,1fr)_100px]";

  return (
    <div className="rounded-lg border flex-1 min-h-0 overflow-auto [scrollbar-gutter:stable]">
      {/* Header */}
      <div className={cn("grid items-center gap-2 border-b p-3 min-w-fit", cols)}>
        <Skeleton className="h-3.5 w-10" />
        <Skeleton className="h-3.5 w-12 mx-auto" />
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3.5 w-12 ml-auto" />
        <Skeleton className="h-3.5 w-12 mx-auto" />
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3.5 w-14" />
      </div>

      {/* Rows */}
      <SkeletonArray amount={rows}>
        <div className={cn("grid items-center gap-2 border-b p-3 min-w-fit", cols)}>
          <Skeleton className="h-3.5 w-8" />
          <Skeleton className="h-5 w-14 rounded-full mx-auto" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-14 ml-auto" />
          <Skeleton className="h-5 w-16 rounded-full mx-auto" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </SkeletonArray>
    </div>
  );
}

/**
 * Skeleton for <PublicProductsGrid>. Mirrors the grid's exact @container
 * column breakpoints so the placeholder column count matches what the real
 * grid renders at every width - viewport-based sm:/lg:/xl: columns drift on
 * wide screens, where the real grid shows 5-6 columns and the page would
 * visibly reflow when it streams in.
 */
export function SkeletonProductGrid({
  amount = 8,
  showButton = true,
}: {
  amount?: number;
  showButton?: boolean;
} = {}) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 @[584px]:grid-cols-2 @[888px]:grid-cols-3 @[1192px]:grid-cols-4 @[1496px]:grid-cols-5 @[1800px]:grid-cols-6 gap-6">
        <SkeletonArray amount={amount}>
          <SkeletonProductGridCard showButton={showButton} />
        </SkeletonArray>
      </div>
    </div>
  );
}

export function SkeletonProductGridCard({
  // The shared <ProductCard> only renders the add-to-cart button when given an
  // `onQuickView` handler (the grid does; the wishlist and carousels don't), so
  // surfaces without it pass `showButton={false}` to keep the skeleton height
  // matched to the real card.
  showButton = true,
}: {
  showButton?: boolean;
} = {}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
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
        {showButton && <SkeletonButton className="w-full mt-3" />}
      </div>
    </div>
  );
}

export function SkeletonProductTableRow({
  showActions = false,
  showCreatedBy = false,
}: {
  showActions?: boolean;
  showCreatedBy?: boolean;
}) {
  // Columns mirror ProductTable's COLS_BASE / COLS_CREATED_BY / COLS_ACTIONS so
  // the skeleton lines up under <ProductTableHeader>. Every combination is
  // spelled out as a literal class so Tailwind's JIT scanner picks it up -
  // string-concatenating an arbitrary-value class doesn't work.
  // Height is driven by the 48px thumbnail.
  const cols = showCreatedBy
    ? showActions
      ? "grid-cols-[64px_minmax(100px,1fr)_120px_minmax(150px,2fr)_120px_100px_140px_116px]"
      : "grid-cols-[64px_minmax(100px,1fr)_120px_minmax(150px,2fr)_120px_100px_140px]"
    : showActions
      ? "grid-cols-[64px_minmax(100px,1fr)_120px_minmax(150px,2fr)_120px_100px_116px]"
      : "grid-cols-[64px_minmax(100px,1fr)_120px_minmax(150px,2fr)_120px_100px]";
  return (
    <div
      role="row"
      className={cn("grid items-center gap-4 border-b p-3 min-w-fit", cols)}
    >
      <Skeleton className="h-12 w-12 rounded border" />
      <SkeletonText rows={1} size="md" className="w-3/4" />
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-3.5 w-16" />
      </div>
      <SkeletonText rows={1} size="md" className="w-full" />
      <Skeleton className="h-3.5 w-16 ml-auto" />
      <Skeleton className="h-5 w-16 rounded-full mx-auto" />
      {showCreatedBy && <Skeleton className="h-3.5 w-20" />}
      {showActions && (
        <div className="flex items-center justify-end gap-1">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      )}
    </div>
  );
}

export function SkeletonPayoutRow() {
  // h-14 matches OrgPayoutTableRow's fixed height (rows stay even whether or not
  // a payout shows the 2-line refund amount).
  return (
    <div
      role="row"
      className="grid grid-cols-[minmax(120px,1fr)_120px_90px_150px_180px] items-center gap-4 border-b h-14 px-3 min-w-fit"
    >
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-3.5 w-12" />
      <Skeleton className="h-3.5 w-16 ml-auto" />
      <Skeleton className="h-5 w-20 rounded-full mx-auto" />
    </div>
  );
}

export function SkeletonOrderRow({
  cols = "grid-cols-[100px_100px_80px_minmax(200px,2fr)_120px_230px]",
  withBuyer = false,
}: {
  /** Grid template to match the list's header (buyer vs org differ). */
  cols?: string;
  /** Org orders add a "buyer" column between items and subtotal. */
  withBuyer?: boolean;
} = {}) {
  return (
    <div
      role="row"
      className={cn("grid items-center gap-4 border-b p-3 min-w-fit", cols)}
    >
      <Skeleton className="h-3.5 w-16" />
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="h-3.5 w-12" />
      <Skeleton className="h-3.5 w-40" />
      {withBuyer && <Skeleton className="h-3.5 w-24" />}
      <Skeleton className="h-3.5 w-16 ml-auto" />
      <Skeleton className="h-5 w-20 rounded-full mx-auto" />
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
    <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
      <div className="px-4">
        <SkeletonText rows={1} size="lg" className={titleWidth} />
      </div>
      <div className="px-4 space-y-3">
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
      <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
        <div className="flex items-center justify-between px-4">
          <SkeletonText rows={1} size="lg" className="w-48" />
          <SkeletonButton className="w-28" />
        </div>

        <div className="px-4 space-y-3">
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
      <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
        <div className="px-4">
          <SkeletonText rows={1} size="lg" className="w-24" />
        </div>
        <div className="px-4 space-y-3">
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
      <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
        <div className="px-4">
          <SkeletonText rows={1} size="lg" className="w-24" />
        </div>

        <div className="px-4 space-y-3">
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

export function SkeletonOrderDetail() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs segments={3} />
        <SkeletonPageHeader
          titleWidth="w-48"
          descriptionWidth="w-64"
          actions={<SkeletonButton className="w-28" />}
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        {/* Real page constrains the cards to max-w-2xl (left-aligned) - without
            this the skeleton cards span full width and read too wide. */}
        <div className="max-w-2xl space-y-6">
          {/* 1. Summary - CardHeader (pb-3) + payment/status badges; 2 rows. */}
          <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
            <div className="flex flex-row items-center justify-between px-4 pb-3">
              <Skeleton className="h-5 w-28" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            <div className="px-4 space-y-1.5">
              <SkeletonArray amount={2}>
                <div className="flex h-5 items-center justify-between">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
              </SkeletonArray>
            </div>
          </div>

          {/* 2. Shipping / fulfillment - icon + title, a seller row + lines. */}
          <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-28" />
              </div>
            </div>
            <div className="px-4 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>

          {/* 3. Items + order totals. */}
          <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
            <div className="px-4 pb-3">
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="px-4">
              <div className="space-y-3">
                <SkeletonArray amount={3}>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-14 w-14 shrink-0 rounded border" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                </SkeletonArray>
              </div>
              <div className="my-4 h-px bg-border" />
              <div className="space-y-1.5">
                <div className="flex h-5 items-center justify-between">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
                <div className="flex h-5 items-center justify-between">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
                <div className="flex h-5 items-center justify-between">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Shipping address - this CardHeader has NO pb-3; icon + title. */}
          <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
            <div className="px-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
            <div className="px-4 space-y-0.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonOrgOrderDetail() {
  // Org (seller) order detail: Summary -> Payment history -> Items -> Address.
  // (Action managers - status / shipment / returns - render conditionally on
  // actionable orders, so they're left out of the base skeleton.) Cards are
  // constrained to max-w-2xl with `space-y-5`, matching the real page.
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs segments={3} />
        <SkeletonPageHeader
          titleWidth="w-48"
          descriptionWidth="w-64"
          actions={<SkeletonButton className="w-28" size="sm" />}
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <div className="max-w-2xl space-y-5">
          {/* 1. Summary */}
          <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
            <div className="flex flex-row items-center justify-between px-4 pb-3">
              <Skeleton className="h-5 w-28" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            <div className="px-4 space-y-1.5">
              <SkeletonArray amount={2}>
                <div className="flex h-5 items-center justify-between">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
              </SkeletonArray>
            </div>
          </div>

          {/* 2. Payment history - icon + title; transaction rows (badge + amount). */}
          <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
            <div className="px-4 space-y-3">
              <SkeletonArray amount={2}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-3 w-14" />
                    </div>
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Skeleton className="h-3.5 w-16" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
              </SkeletonArray>
            </div>
          </div>

          {/* 3. Items + totals */}
          <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
            <div className="px-4 pb-3">
              <Skeleton className="h-5 w-28" />
            </div>
            <div className="px-4">
              <div className="space-y-3">
                <SkeletonArray amount={3}>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-14 w-14 shrink-0 rounded border" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                </SkeletonArray>
              </div>
              <div className="my-4 h-px bg-border" />
              <div className="space-y-1.5">
                <div className="flex h-5 items-center justify-between">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
                <div className="flex h-5 items-center justify-between">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Shipping address */}
          <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
            <div className="px-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-5 w-32" />
              </div>
            </div>
            <div className="px-4 space-y-0.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
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
  // Mirrors the real <OrganizationCard>. This project's Card is NOT stock shadcn:
  // `gap-4 py-4 ring-1 ring-foreground/10` with `px-4` header/content (no border,
  // no shadow at rest). Header = title (text-lg) + verified badge stacked, plus a
  // `sm` toggle button; content = members label + member rows.
  return (
    <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
      <div className="flex flex-row items-center justify-between px-4">
        <div className="space-y-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
      <div className="px-4">
        <Skeleton className="mb-2 h-4 w-24" />
        <div className="space-y-1">
          <SkeletonArray amount={members}>
            <div className="flex items-center justify-between py-0.5">
              <Skeleton className="h-4 w-40" />
              <div className="flex items-center gap-2">
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
  // Mirrors the real user card in AdminUsersPage: header (name + email + role
  // badge, mb-4) then <UserForm> which is `space-y-6` with a full-width role
  // Select over a separate button row - so the skeleton matches its height.
  return (
    <div className="border rounded-lg p-4 bg-background">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-10" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the desktop `<FilterSidebar>` chrome (the `w-56 border-r` aside).
 * Mirrors the real sidebar frame so a `loading.tsx` lines up with the mounted
 * client page instead of flashing a different layout.
 */
export function SkeletonFilterSidebar({ groups = 3 }: { groups?: number }) {
  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r">
      <div className="shrink-0 pr-6 pt-1 pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="mt-3 border-t" />
      </div>
      <div className="flex-1 overflow-y-auto pr-6 pt-2 space-y-5">
        <SkeletonArray amount={groups}>
          <div className="space-y-2.5">
            <Skeleton className="h-3.5 w-24" />
            <div className="space-y-2">
              <SkeletonArray amount={3}>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-sm shrink-0" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </SkeletonArray>
            </div>
          </div>
        </SkeletonArray>
      </div>
    </aside>
  );
}

/**
 * Skeleton for the `<SearchToolbar>` row (search input + sort control).
 */
export function SkeletonSearchToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Skeleton className="h-9 w-full max-w-xs rounded-md" />
      <Skeleton className="h-9 w-28 rounded-md" />
    </div>
  );
}

function SkeletonTranslatableSection() {
  // English (default) + one per non-default locale all render the same box:
  // rounded-md border, a locale label, then title / slug / short-desc / desc.
  return (
    <div className="rounded-md border border-border/60 p-4 space-y-4">
      <div className="flex h-4 items-center">
        <Skeleton className="h-3 w-24" />
      </div>
      {/* Title */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      {/* Slug (with a description row) */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-12" />
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-3 w-64" />
      </div>
      {/* Short description */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      {/* Description (Textarea, min-h-30) */}
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-30 w-full rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonProductForm() {
  // Mirrors <ProductForm>: a compact `bg-muted` TabsList (p-[3px], ~h-6 pill
  // triggers) then the Details tab, whose translatable fields sit inside a
  // `rounded-md border border-border/60 p-4` section (the "separating line" the
  // bare-field version was missing).
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* <RequiredFieldsNote /> - text-xs line sitting directly above <Tabs>,
          no gap class between them on the form element itself. */}
      <Skeleton className="h-3 w-56 shrink-0" />

      {/* <Tabs> is `flex flex-col gap-2` - the 8px gap between the tab list and
          its content must be reproduced or the fields sit 8px too high. */}
      <div className="flex-1 min-h-0 flex flex-col gap-2">
        {/* TabsList (bg-muted pill, compact ~h-6 triggers) */}
        <div className="shrink-0 flex w-full flex-wrap items-center gap-1 rounded-lg bg-muted p-0.75">
          <Skeleton className="h-6 w-14 rounded-md" />
          <Skeleton className="h-6 w-14 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-6 w-10 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
        </div>

        {/* Details tab content. `[scrollbar-gutter:stable]` reserves the same
            width the real form's scrollbar takes, so nothing nudges left. */}
        <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] space-y-6 pt-4 pb-6">
          {/* Translatable sections: default locale + one per other locale.
              SUPPORTED_LOCALES = en/sr/de/es -> 4 identical bordered boxes.
              (The bare single-box version left the sr/de/es sections mismatched
              against categories/brand below, causing a shift.) */}
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonTranslatableSection key={i} />
          ))}

          {/* Categories */}
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>

          {/* Brand */}
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>

          {/* Separator */}
          <div className="h-px bg-border" />

          {/* Media (label is text-base font-semibold, 16px) */}
          <div className="space-y-2">
            <div className="flex h-4 items-center">
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-36 w-full rounded-md" />
          </div>
        </div>
      </div>

      {/* Save bar (form.tsx: shrink-0 pt-4 pb-6 border-t) */}
      <div className="shrink-0 pt-4 pb-6 border-t">
        <SkeletonButton className="w-36" />
      </div>
    </div>
  );
}
