import { Footer } from "@/components/layout/footer";
import {
  Skeleton,
  SkeletonBreadcrumbs,
  SkeletonButton,
} from "@/components/ui/skeleton";

/**
 * The order-confirmation page resolves the Stripe session and loads the order
 * before it renders anything, which is the slowest moment in the purchase flow
 * and the one where a frozen screen reads as "did my payment go through?".
 *
 * The page itself returns a FRAGMENT - the `(public)` layout's <main> is the
 * flex column - so this must too. Wrapping it in another `flex-1 flex flex-col`
 * div would have added a nesting level the real page does not have.
 *
 * Every placeholder below sits inside a box as tall as the real element's LINE
 * BOX, with a thinner bar inside it - the same split SkeletonBreadcrumbs
 * documents. Sizing the bar itself to the row (`h-6` for an `text-2xl`
 * heading, say) undershoots by the leading, and the shortfalls add up: the
 * confirmation block alone used to be 18px short, so the whole page visibly
 * dropped the moment the order arrived.
 */
export default function CheckoutSuccessLoading() {
  return (
    <>
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        {/* home / checkout / order confirmation */}
        <SkeletonBreadcrumbs segments={3} />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="flex-1 px-6 py-12 max-w-xl mx-auto w-full space-y-8">
          {/* Confirmation block: a 64px icon, then three lines of text whose
              heights come from their own leading - `text-2xl` is 32px,
              `text-sm` 20px, `text-xs` 16px. */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <Skeleton className="h-16 w-16 rounded-full" />
            </div>
            <div className="flex h-8 items-center justify-center">
              <Skeleton className="h-6 w-56" />
            </div>
            <div className="flex h-5 items-center justify-center">
              <Skeleton className="h-3.5 w-72" />
            </div>
            <div className="flex h-4 items-center justify-center">
              <Skeleton className="h-3 w-64" />
            </div>
          </div>

          {/* Order summary. CardTitle is an icon + text row at `text-base
              leading-snug`, so the row is 22px, not the icon's 16px.
              CardContent is `space-y-0` with its own separators. */}
          <SuccessCard>
            <SuccessCardTitle width="w-32" />
            <div className="px-4">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i}>
                  {i > 0 && <div className="my-3 h-px bg-border" />}
                  {/* Thumbnail is h-14 w-14, taller than the three text lines
                      beside it, so it sets the row height either way. */}
                  <div className="flex gap-4 items-center">
                    <Skeleton className="h-14 w-14 shrink-0 rounded border" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                </div>
              ))}
              <div className="my-4 h-px bg-border" />
              {/* Subtotal and shipping only render when there is a discount or
                  a shipping charge; a flat-rate COD order is the common case,
                  so model that rather than the bare total. */}
              <div className="flex h-5 items-center justify-between">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-20" />
              </div>
              <div className="mt-1.5 flex h-5 items-center justify-between">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-16" />
              </div>
              <div className="my-3 h-px bg-border" />
              <div className="flex h-5 items-center justify-between">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            </div>
          </SuccessCard>

          {/* Shipping address: `text-sm text-muted-foreground space-y-0.5`, so
              every line is a 20px box. Four lines is the shape without an
              address line 2. */}
          <SuccessCard>
            <SuccessCardTitle width="w-36" />
            <div className="px-4 space-y-0.5">
              {["w-40", "w-56", "w-44", "w-28"].map((width) => (
                <div key={width} className="flex h-5 items-center">
                  <Skeleton className={`h-3.5 ${width}`} />
                </div>
              ))}
            </div>
          </SuccessCard>

          {/* Two default-size (h-8) PendingLinkButtons - view my orders and
              continue shopping. */}
          <div className="flex flex-col gap-3">
            <SkeletonButton className="w-full" />
            <SkeletonButton className="w-full" />
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}

/** <Card>'s own box: `flex flex-col gap-4 rounded-xl bg-card py-4 ring-1`. */
function SuccessCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 ring-1 ring-foreground/10">
      {children}
    </div>
  );
}

/** CardHeader + CardTitle: a `h-4 w-4` icon beside 22px of `text-base` text. */
function SuccessCardTitle({ width }: { width: string }) {
  return (
    <div className="px-4 flex h-5.5 items-center gap-2">
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className={`h-4 ${width}`} />
    </div>
  );
}
