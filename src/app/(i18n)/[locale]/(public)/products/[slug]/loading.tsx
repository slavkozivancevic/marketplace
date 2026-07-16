import { Footer } from "@/components/layout/footer";
import {
  Skeleton,
  SkeletonArray,
  SkeletonBreadcrumbs,
  SkeletonButton,
  SkeletonPageHeader,
  SkeletonText,
} from "@/components/ui/skeleton";

/**
 * Mirrors the real product detail layout 1:1 so nothing shifts when the page
 * streams in:
 *   header  - Breadcrumbs (h-8 row) + PageHeader (pt-6 pb-4 mb-2) with the
 *             "Back to products" outline button on the right
 *   left    - ProductImageCarousel: h-96 rounded-lg main frame + w-16 h-16
 *             thumb strip (space-y-3)
 *   right   - ProductPurchaseSection (space-y-6): purchase Card (price row +
 *             wishlist circle, brand row, description, variant pills, add-to-
 *             cart + message-seller buttons), then the variants Card
 *   below   - reviews section (mt-12, always renders). The related /
 *             recently-viewed carousels are data-dependent, so no skeleton -
 *             promising content that may never come is worse than none.
 */
export default function ProductDetailLoading() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <SkeletonBreadcrumbs width="w-72" />
        <SkeletonPageHeader
          titleWidth="w-64"
          descriptionWidth="w-80"
          actions={<SkeletonButton className="w-36" />}
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="flex-1 px-6 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Gallery */}
            <div className="space-y-3">
              <Skeleton className="h-96 w-full rounded-lg" />
              <div className="flex gap-2 flex-wrap">
                <SkeletonArray amount={4}>
                  <Skeleton className="h-16 w-16 rounded" />
                </SkeletonArray>
              </div>
            </div>

            {/* Purchase panel */}
            <div className="space-y-6">
              {/* Purchase card: Card py-4 + CardContent px-4 pt-6 */}
              <div className="rounded-xl bg-card ring-1 ring-foreground/10 px-4 pt-10 pb-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  {/* text-3xl price line */}
                  <Skeleton className="h-9 w-36" />
                  {/* wishlist heart button */}
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                {/* brand row */}
                <Skeleton className="h-5 w-40" />
                {/* description */}
                <SkeletonText rows={3} size="md" />
                {/* variant option pills (px-3 py-1.5 text-sm = h-8) */}
                <div className="space-y-2.5">
                  <Skeleton className="h-5 w-24" />
                  <div className="flex flex-wrap gap-2">
                    <Skeleton className="h-8 w-20 rounded-md" />
                    <Skeleton className="h-8 w-24 rounded-md" />
                    <Skeleton className="h-8 w-16 rounded-md" />
                  </div>
                </div>
                {/* add-to-cart (size lg) + message seller */}
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
              </div>

              {/* Variants card: Card py-4 gap-4, CardHeader/CardContent px-4 */}
              <div className="rounded-xl bg-card ring-1 ring-foreground/10 py-4 space-y-4">
                <div className="px-4">
                  <Skeleton className="h-5 w-28" />
                </div>
                <div className="px-4 space-y-2">
                  <SkeletonArray amount={3}>
                    <Skeleton className="h-10 w-full rounded" />
                  </SkeletonArray>
                </div>
              </div>
            </div>
          </div>

          {/* Reviews section (always present under the grid) */}
          <div className="mt-12 space-y-6">
            <Skeleton className="h-7 w-44" />
            <div className="space-y-4">
              <SkeletonArray amount={2}>
                <div className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <SkeletonText rows={2} size="md" />
                  </div>
                </div>
              </SkeletonArray>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
