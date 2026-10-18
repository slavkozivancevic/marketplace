import { SkeletonBreadcrumbs } from "@/components/ui/skeleton";
import { CartPageSkeleton } from "@/features/cart/components/CartPageSkeleton";

/**
 * Cart page skeleton.
 *
 * Returns a FRAGMENT: the `(public)` layout's <main> is the flex column, so
 * wrapping this in another `flex-1 flex flex-col` would add a nesting level the
 * real page does not have. The body is shared with `CartPage`, which shows it
 * while the persisted cart is still being read - see `CartPageSkeleton`.
 */
export default function CartLoading() {
  return (
    <>
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        {/* home / cart */}
        <SkeletonBreadcrumbs segments={2} />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <CartPageSkeleton />
      </div>
    </>
  );
}
