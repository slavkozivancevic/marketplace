import {
  Skeleton,
  SkeletonArray,
  SkeletonBreadcrumbs,
  SkeletonButton,
  SkeletonFilterSidebar,
  SkeletonProductGridCard,
  SkeletonSearchToolbar,
  SkeletonText,
} from "@/components/ui/skeleton";

// Brand name/logo are dynamic (per slug); the hero strip renders as skeletons
// above the same filtered catalog grid as /products.
export default function BrandLoading() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-6 pb-4">
        <SkeletonBreadcrumbs width="w-56" />
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-xl" />
            <div className="space-y-2">
              <SkeletonText rows={1} size="lg" className="w-48" />
              <SkeletonText rows={1} size="md" className="w-64" />
            </div>
          </div>
          <SkeletonButton className="w-32" />
        </div>
      </div>
      <div className="flex flex-col flex-1 min-h-0 gap-4">
        <div className="shrink-0 px-6">
          <SkeletonSearchToolbar />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] flex flex-col">
          <div className="flex gap-6 flex-1 px-6">
            <SkeletonFilterSidebar />
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <SkeletonArray amount={8}>
                  <SkeletonProductGridCard />
                </SkeletonArray>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
