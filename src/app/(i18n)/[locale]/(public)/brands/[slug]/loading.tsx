import {
  Skeleton,
  SkeletonBreadcrumbs,
  SkeletonButton,
  SkeletonFilterSidebar,
  SkeletonProductGrid,
  SkeletonSearchToolbar,
} from "@/components/ui/skeleton";

// Brand name/logo are dynamic (per slug); the hero strip renders as skeletons
// above the same filtered catalog grid as /products. Reproduces the real
// hero's box exactly: no gap between <Breadcrumbs> (own pb-1) and the row
// below (the real page has none either), a 64px logo, and h-8/h-5 row
// wrappers pinning the title/description bars to the real `text-2xl`/
// `text-sm` line-heights (a bare skeleton bar alone sits shorter than that).
export default function BrandLoading() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 pb-4 mb-2 sticky-header-bg">
        <SkeletonBreadcrumbs segments={3} />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Skeleton className="h-16 w-16 rounded-xl shrink-0" />
            <div className="space-y-0.5 min-w-0">
              <div className="flex h-8 items-center">
                <Skeleton className="h-6 w-48" />
              </div>
              <div className="flex h-5 items-center">
                <Skeleton className="h-3.5 w-64" />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <SkeletonButton className="w-32" />
          </div>
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
              <SkeletonProductGrid />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
