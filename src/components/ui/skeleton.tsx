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
 *
 * The `secondary` variant is borrowed for geometry only - its `bg-secondary`
 * fill is overridden with `bg-muted` (twMerge keeps the later class) so the
 * placeholder reads at the same contrast as every other skeleton in the light
 * theme, where --secondary sits only 3% below --background.
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
          className: "pointer-events-none w-24 animate-pulse bg-muted",
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
  // Fill MUST be `bg-muted`, the same token <Skeleton> uses. It used to be
  // `bg-secondary`, which is fine in the dark themes (where --secondary and
  // --muted are the same lightness) but effectively invisible in the light
  // theme: --secondary is oklch(0.91) against a --background of oklch(0.94),
  // a 3% lightness delta. That's why table skeletons looked half-empty - the
  // thumbnail and brand-logo placeholders (plain <Skeleton>, bg-muted at 0.885)
  // showed, while the title/description placeholders (SkeletonText) did not.
  return (
    <div className="flex flex-col gap-1.5">
      <SkeletonArray amount={rows}>
        <div
          className={cn(
            "w-full animate-pulse rounded-sm bg-muted",
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
          <div className="flex flex-wrap items-center justify-end gap-2 md:shrink-0">{actions}</div>
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
          {/* <CardTitle className="text-lg"> keeps the base's `leading-snug`,
              because twMerge only drops the conflicting `text-base` - line
              height stays 1.375. So the title's line box is 18 x 1.375 =
              24.75px, NOT the 28px `text-lg` would give on its own and not the
              20px a bare `h-5` bar reserved. Getting this wrong is why the real
              org name appeared to drop below its own placeholder. */}
          <div className="flex h-[24.75px] items-center">
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-5 w-20 rounded-4xl" />
        </div>
        {/* `size="sm"` verify/unverify button. */}
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
      <div className="px-4">
        {/* `<p className="text-sm font-medium mb-2">` - a 20px line box. */}
        <div className="mb-2 flex h-5 items-center">
          <Skeleton className="h-3.5 w-24" />
        </div>
        <div className="space-y-1">
          <SkeletonArray amount={members}>
            {/* Member rows are `flex items-center justify-between text-sm` with
                NO padding of their own - 20px, set by the text and the h-5
                badges alike. The old `py-0.5` made every row 4px too tall. */}
            <div className="flex h-5 items-center justify-between">
              <Skeleton className="h-3.5 w-40" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-14 rounded-4xl" />
                <Skeleton className="h-5 w-16 rounded-4xl" />
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
  // badge, mb-4) then <UserForm>, which is `space-y-6` with a full-width role
  // Select over a separate button row.
  return (
    <div className="border rounded-lg p-4 bg-background">
      <div className="mb-4 flex items-start justify-between gap-4">
        {/* Two stacked <p>s with NO gap between them: a `font-semibold` name at
            the inherited 16px (24px line box) over a `text-sm` email (20px).
            The old `space-y-1.5` invented a gap the real card doesn't have. */}
        <div>
          <div className="flex h-6 items-center">
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-56" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-4xl" />
      </div>
      <div className="space-y-6">
        <div className="space-y-2">
          {/* <FormLabel> is `text-sm leading-none` - 14px, not a 20px line box. */}
          <Skeleton className="h-3.5 w-10" />
          {/* <SelectTrigger> is h-8 / rounded-lg, like every other control. */}
          <Skeleton className="h-8 w-full rounded-lg" />
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
export function SkeletonFilterSidebar({
  groups = [3, 3, 3],
}: {
  /**
   * One entry per filter group, in the order the page builds them. A number is
   * a checkbox facet with that many options; `"range"` is the min/max input
   * pair (used by the price filter) and `"rating"` is the star row - both have
   * their own height rather than a list of 20px option rows.
   */
  groups?: (number | "range" | "rating")[];
} = {}) {
  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r">
      {/* Header box: `pr-6 pt-1 pb-2`. Its row is 24px tall, not 20px - the
          "Clear all" ghost button (`h-auto py-1 text-xs`) is taller than the
          `text-sm` "Filters" label next to it, and it stays mounted (just
          `invisible`) when no filter is active. */}
      <div className="shrink-0 pr-6 pt-1 pb-2">
        <div className="flex h-6 items-center justify-between">
          <Skeleton className="h-3.5 w-12" />
        </div>
        {/* <Separator className="mt-2" /> - h-px, 8px above (NOT mt-3). */}
        <div className="mt-2 h-px w-full bg-border" />
      </div>
      {/* Body: the real scroller is `pr-6 -ml-1.5 pl-1.5` with no padding-top
          of its own - the 16px gap comes from <FilterGroups>' own `pt-4`. */}
      <div className="flex-1 overflow-y-auto pr-6 -ml-1.5 pl-1.5">
        <div className="space-y-4 pt-4">
          {groups.map((group, g) => (
            <div key={g}>
              {/* Both filter kinds are `space-y-2`: a `text-sm font-medium`
                  label (20px line box) over the control. */}
              <div className="space-y-2">
                <div className="flex h-5 items-center">
                  <Skeleton className="h-3.5 w-24" />
                </div>
                {group === "range" ? (
                  // RangeFilter: two `h-8 rounded-lg` inputs with a `text-xs`
                  // "to" between them.
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 flex-1 min-w-0 rounded-lg" />
                    <Skeleton className="h-3 w-4 shrink-0" />
                    <Skeleton className="h-8 flex-1 min-w-0 rounded-lg" />
                  </div>
                ) : group === "rating" ? (
                  // StarRatingFilter: a single 20px star row plus an "and up"
                  // caption, not a list.
                  <div className="flex h-5 items-center gap-2">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-3 w-12 shrink-0" />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {Array.from({ length: group }, (_, o) => (
                      // Each option is a `flex items-center gap-2 text-sm`
                      // label: a size-4 checkbox (rounded-lg) plus the option
                      // text, so the row is 20px tall - driven by the text, not
                      // the box.
                      <div key={o} className="flex h-5 items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded-lg shrink-0" />
                        <Skeleton className="h-3.5 flex-1" />
                        {/* Facet count slot - `min-w-6` right-aligned, exactly
                            as <CheckboxFilter> reserves it, so the route-level
                            fallback and the mounted sidebar agree. */}
                        <span className="flex min-w-6 shrink-0 justify-end">
                          <Skeleton className="h-3 w-5" />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* <Separator className="mt-4" /> closes every group. */}
              <div className="mt-4 h-px w-full bg-border" />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/**
 * Skeleton for the `<SearchToolbar>` row (search input + optional mobile filter
 * button + sort control).
 *
 * Sizes come from the real controls, which are SMALLER than they look: both
 * `<Input>` and `<SelectTrigger>` are `h-8` with `rounded-lg`, not `h-9
 * rounded-md`. The search field is `flex-1 min-w-40 max-w-sm`, not a fixed
 * `max-w-xs`.
 */
export function SkeletonSearchToolbar({
  /** Set false on toolbars rendered without filter groups (no mobile sheet). */
  withMobileFilter = true,
}: {
  withMobileFilter?: boolean;
} = {}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Skeleton className="h-8 flex-1 min-w-40 max-w-sm rounded-lg" />
      <div className="flex items-center gap-2">
        {/* <MobileFilterSheet> renders a default-size outline button below lg. */}
        {withMobileFilter && <Skeleton className="lg:hidden h-8 w-9 rounded-lg sm:w-20" />}
        {/* <SortSelect>'s trigger is `w-fit`, so its width follows the
            translated label; capped at `max-w-28` below sm. This is the one
            measurement a server-rendered placeholder cannot derive - it only
            affects the control's own width, never the row height. */}
        <Skeleton className="h-8 w-28 sm:w-44 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Toolbar variant used by the admin USERS and ORGANIZATIONS pages: a search
 * field, the mobile filter button, and a right-aligned result count - no sort
 * control. Their `loading.tsx` files used to hand-roll a single
 * `h-9 ... rounded-md` bar, which was wrong on every count: the real
 * <SearchInput> is `h-8 rounded-lg` and `flex-1 max-w-sm`, and the button and
 * counter were missing entirely.
 */
export function SkeletonSearchCountToolbar() {
  return (
    <div className="shrink-0 flex flex-wrap items-center gap-3">
      <Skeleton className="h-8 flex-1 min-w-0 max-w-sm rounded-lg" />
      {/* <MobileFilterSheet>: icon-only below sm, icon + label from sm up. */}
      <Skeleton className="lg:hidden h-8 w-9 rounded-lg sm:w-20" />
      {/* `text-xs` result count - a 16px line box. */}
      <div className="ml-auto flex h-4 items-center">
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/**
 * Collapsed <ActiveFilters> spacer.
 *
 * The real toolbar column is `flex flex-col gap-4` with THREE children -
 * toolbar, active-filters, list - and the middle one is a `grid-rows-[0fr]`
 * box that is zero-height until a filter is applied. It still consumes a 16px
 * flex gap, so a skeleton that omits it sits 16px too high.
 */
export function SkeletonActiveFiltersSpacer() {
  return (
    <div className="grid grid-rows-[0fr]">
      <div className="overflow-hidden" />
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
