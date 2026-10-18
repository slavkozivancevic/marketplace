import {
  Skeleton,
  SkeletonArray,
  SkeletonButton,
  SkeletonText,
} from "@/components/ui/skeleton";

/**
 * The cart page body while there is nothing real to show yet.
 *
 * Two callers, one shape: the route's `loading.tsx` while the server renders,
 * and `CartPage` itself while the persisted cart is read back from
 * localStorage. Before the second one existed, a direct load of /cart showed
 * "Your cart is empty" for a moment to a buyer with items in it.
 *
 * Every box mirrors the real element's own geometry rather than approximating
 * it, so nothing moves when the cart renders:
 *
 * - The wrapper repeats `mx-auto max-w-5xl px-6 py-6` and the two-column grid
 *   (`minmax(0,1fr) 20rem`, `gap-6`) from CartPage.
 * - `<Card>` is `rounded-xl bg-card py-4 ring-1 ring-foreground/10` with a
 *   `px-4` content box - a `border p-4` stand-in would be 1px off on all four
 *   sides and a shade different in both themes.
 * - A line is CartLineRow's own stack: a 64px thumbnail beside title (20px),
 *   price (20px) and the 24px stepper row, with `gap-1` and `mt-1` between
 *   them, inside `py-1`. Separators repeat the page's `my-3`.
 * - The two buttons are `size="lg"`, matching the real ones, so the card's
 *   height is right to the pixel.
 *
 * The free-shipping bar and the delivery-estimate notice are deliberately NOT
 * drawn: both are conditional on the cart's contents, and reserving space for
 * something that usually is not there is a worse jump than not reserving it.
 */
export function CartPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      {/* `text-2xl` heading: a 32px line box with the bar inside it. */}
      <div className="flex h-8 items-center mb-5">
        <Skeleton className="h-6 w-28" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start">
        <div className="min-w-0">
          <div className="rounded-xl bg-card py-4 ring-1 ring-foreground/10">
            <div className="px-4">
              <SkeletonArray amount={2}>
                {/* `first:mt-0` reproduces the Separator the real list puts
                    BETWEEN rows (my-3 on each side plus its own 1px). */}
                <div className="mt-6.25 first:mt-0">
                  <div className="flex gap-3 py-1">
                    <Skeleton className="h-16 w-16 shrink-0 rounded" />
                    <div className="flex flex-1 flex-col gap-1 min-w-0">
                      {/* title: text-sm, a 20px line box */}
                      <div className="flex h-5 items-center">
                        <SkeletonText rows={1} size="md" className="w-2/3" />
                      </div>
                      {/* price: text-sm, same 20px box */}
                      <div className="flex h-5 items-center">
                        <SkeletonText rows={1} size="md" className="w-24" />
                      </div>
                      {/* stepper row: three 24px icon buttons */}
                      <div className="flex items-center gap-2 mt-1">
                        <Skeleton className="h-6 w-6 rounded-md" />
                        <Skeleton className="h-6 w-4 rounded-md" />
                        <Skeleton className="h-6 w-6 rounded-md" />
                        <Skeleton className="h-6 w-6 rounded-md ml-auto" />
                      </div>
                    </div>
                  </div>
                </div>
              </SkeletonArray>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-card py-4 ring-1 ring-foreground/10">
          <div className="px-4 space-y-4">
            {/* Summary: subtotal + delivery as text-sm rows (20px each,
                space-y-1.5), then the total row with its own pt-1. */}
            <div className="space-y-1.5">
              <div className="flex h-5 items-center justify-between">
                <SkeletonText rows={1} size="md" className="w-20" />
                <SkeletonText rows={1} size="md" className="w-16" />
              </div>
              <div className="flex h-5 items-center justify-between">
                <SkeletonText rows={1} size="md" className="w-16" />
                <SkeletonText rows={1} size="md" className="w-12" />
              </div>
              {/* The total row is `pt-1` over a 20px line box, so 24px in
                  all - the padding has to sit on the OUTER element and the
                  line box inside it. Putting `pt-1` on a `h-5` box instead
                  would eat into that 20px (border-box) and leave the row
                  4px short. The text is bolder, not bigger. */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex h-5 items-center">
                  <SkeletonText rows={1} size="md" className="w-14" />
                </div>
                <div className="flex h-5 items-center">
                  <SkeletonText rows={1} size="md" className="w-20" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <SkeletonButton size="lg" className="w-full" />
              <SkeletonButton size="lg" className="w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
