import { Skeleton, SkeletonBreadcrumbs } from "@/components/ui/skeleton";

/**
 * The order-confirmation page resolves the Stripe session and loads the order
 * before it renders anything, which is the slowest moment in the purchase flow
 * and the one where a frozen screen reads as "did my payment go through?".
 *
 * The page itself returns a FRAGMENT - the `(public)` layout's <main> is the
 * flex column - so this must too. Wrapping it in another `flex-1 flex flex-col`
 * div would have added a nesting level the real page does not have.
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
          {/* Confirmation block: a 64px icon, an `text-2xl font-bold` heading,
              then a `text-sm` and a `text-xs` line. */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <Skeleton className="h-16 w-16 rounded-full" />
            </div>
            <Skeleton className="h-6 w-56 mx-auto" />
            <Skeleton className="h-3.5 w-72 mx-auto" />
            <Skeleton className="h-3 w-64 mx-auto" />
          </div>

          {/* Order summary. CardTitle is an icon + text row at `text-base`;
              CardContent is `space-y-0` with its own separators. */}
          <SuccessCard>
            <div className="px-4 flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="px-4">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i}>
                  {i > 0 && <div className="my-3 h-px bg-border" />}
                  <div className="flex gap-4 items-center">
                    {/* Thumbnail is h-14 w-14 with a rounded border. */}
                    <Skeleton className="h-14 w-14 shrink-0 rounded border" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                </div>
              ))}
              <div className="my-4 h-px bg-border" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            </div>
          </SuccessCard>

          {/* Shipping address: `text-sm text-muted-foreground space-y-0.5`. */}
          <SuccessCard>
            <div className="px-4 flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="px-4 space-y-0.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3.5 w-56" />
              <Skeleton className="h-3.5 w-44" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          </SuccessCard>
        </div>
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
