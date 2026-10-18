import { cn } from "@/lib/utils";
import {
  Skeleton,
  SkeletonBreadcrumbs,
  SkeletonButton,
  SkeletonFilterSidebar,
  SkeletonPageHeader,
  SkeletonProductGrid,
  SkeletonSearchToolbar,
} from "@/components/ui/skeleton";

// Category name is dynamic (per slug); the header mirrors the real page's
// `pt-6 pb-4` wrapper + <Breadcrumbs> + <PageHeader> so nothing shifts.
export default function CategoryLoading() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 pb-3 sticky-header-bg">
        <SkeletonBreadcrumbs segments={3} />
        {/* No description bar: a category's description is optional admin
            copy, and `<PageHeader>` renders nothing at all when it is missing.
            Surveyed across all nine departments in this catalogue, none has
            one, and drawing it made the header 156px against the real 134px -
            the whole grid lifted 22px the moment the page arrived. Put it back
            if descriptions become standard content. */}
        <SkeletonPageHeader
          titleWidth="w-56"
          withDescription={false}
          actions={<SkeletonButton className="w-28" />}
        />
        {/* Subcategory chips. Measured on the real page: each chip is 30px
            tall (`py-1.5` over a 16px `text-xs` line box, plus its 1px border
            top and bottom), the row sits `mt-2` under the header and the chips
            are `gap-2` apart. Widths are a spread matching real category names
            - the row wraps the same way as a result.

            DRAWN UNCONDITIONALLY, even though a LEAF category has no chips and
            `loading.tsx` cannot know which kind it is standing in for (it gets
            no params). Departments are what the menu, the directory and the
            home carousel all link to, so the row is there far more often than
            not; omitting it pushed the whole grid down by 38px on exactly
            those pages. */}
        <div className="flex flex-wrap gap-2 mt-2">
          {["w-24", "w-40", "w-32", "w-20", "w-20", "w-28"].map((w, i) => (
            <Skeleton key={i} className={cn("h-7.5 rounded-full", w)} />
          ))}
        </div>
      </div>
      <div className="flex flex-col flex-1 min-h-0 gap-4">
        <div className="shrink-0 px-6">
          <SkeletonSearchToolbar />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] flex flex-col">
          <div className="flex gap-6 flex-1 px-6">
            <SkeletonFilterSidebar groups={["range", "rating", 2, 2, 8]} />
            <div className="flex-1 min-w-0">
              <SkeletonProductGrid />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
