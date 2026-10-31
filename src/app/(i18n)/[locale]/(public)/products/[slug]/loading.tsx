import { Footer } from "@/components/layout/footer";
import {
  Skeleton,
  SkeletonArray,
  SkeletonBreadcrumbs,
  SkeletonButton,
  SkeletonPageHeader,
} from "@/components/ui/skeleton";

/**
 * Mirrors the real product detail page box for box, measured against a
 * typical catalogue product (brand, tags, warranty, one option, in stock):
 *   header  - Breadcrumbs + PageHeader with the short description under the
 *             title and the "Back to products" outline button on the right
 *   left    - ProductImageCarousel's h-96 main frame
 *   right   - ProductPurchaseSection's Card (py-4, content px-4 pt-6
 *             space-y-4): price row (h-9), brand (h-5), tags (h-5), four trust
 *             lines (space-y-1.5), AddToCart (option label + pills, stock line,
 *             quantity + add-to-cart row), message-seller button (h-8)
 *   below   - description / specifications tabs (space-y-10 under the grid),
 *             then the reviews section (mt-12). The related / recently-viewed
 *             carousels are data-dependent, so no skeleton - promising content
 *             that may never come is worse than none.
 * Change the real page and this file together, and re-measure.
 */
export default function ProductDetailLoading() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs segments={3} />
        <SkeletonPageHeader
          titleWidth="w-64"
          descriptionWidth="w-[36rem] max-w-full"
          descriptionLinesOnPhone={2}
          actions={<SkeletonButton className="w-36" />}
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="flex-1 px-6 pb-6">
          <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Gallery main frame */}
              <div className="space-y-4">
                <Skeleton className="h-96 w-full rounded-lg" />
              </div>

              {/* Purchase card */}
              <div className="space-y-6">
                <div className="rounded-xl bg-card ring-1 ring-foreground/10 py-4">
                  <div className="px-4 pt-6 space-y-4">
                    {/* price (text-3xl) + share and wishlist */}
                    <div className="flex h-9 items-center justify-between gap-3">
                      <Skeleton className="h-9 w-40" />
                      <div className="flex items-center gap-1">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                      </div>
                    </div>
                    {/* brand */}
                    <div className="flex h-5 items-center">
                      <Skeleton className="h-4 w-32" />
                    </div>
                    {/* tags */}
                    <div className="flex h-5 items-center">
                      <Skeleton className="h-4 w-44" />
                    </div>
                    {/* warranty, free delivery, lead time, returns */}
                    <div className="space-y-1.5">
                      <SkeletonArray amount={4}>
                        <div className="flex h-5 items-center">
                          <Skeleton className="h-4 w-52" />
                        </div>
                      </SkeletonArray>
                    </div>
                    {/* AddToCart */}
                    <div className="space-y-4">
                      <div>
                        <div className="mb-2.5 flex h-5 items-center">
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Skeleton className="h-8.5 w-20 rounded-md" />
                        </div>
                      </div>
                      <div className="flex h-5 items-center">
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <Skeleton className="h-9 w-28 rounded-md" />
                        <Skeleton className="h-9 w-full sm:flex-1 rounded-md" />
                      </div>
                    </div>
                    {/* message seller */}
                    <Skeleton className="h-8 w-full rounded-md" />
                  </div>
                </div>
              </div>
            </div>

            {/* Description / specifications tabs */}
            {/* Tabs root is flex-col gap-2; TabsContent is text-sm pt-4. */}
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-36 rounded-lg" />
              {/* The description paragraph: three lines on a desktop, six on a
                  phone; each row is one line box of the same type (h-lh). */}
              <div className="pt-4 text-sm max-w-3xl">
                <div className="flex h-lh items-center"><Skeleton className="h-3 w-full" /></div>
                <div className="flex h-lh items-center"><Skeleton className="h-3 w-full" /></div>
                <div className="flex h-lh items-center sm:hidden"><Skeleton className="h-3 w-full" /></div>
                <div className="flex h-lh items-center sm:hidden"><Skeleton className="h-3 w-full" /></div>
                <div className="flex h-lh items-center sm:hidden"><Skeleton className="h-3 w-full" /></div>
                <div className="flex h-lh items-center"><Skeleton className="h-3 w-2/3" /></div>
              </div>
            </div>
          </div>

          {/* Reviews section (always present under the grid): its title and
              the one-line empty state most products show. */}
          <div className="mt-12 space-y-6">
            <Skeleton className="h-7 w-44" />
            <div className="flex h-5 items-center">
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
