import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Skeleton,
  SkeletonBreadcrumbs,
  SkeletonButton,
  SkeletonFilterSidebar,
  SkeletonPageHeader,
  SkeletonProductGrid,
  SkeletonSearchToolbar,
  SkeletonActiveFiltersSpacer,
} from "@/components/ui/skeleton";

// Category name is dynamic (per slug); the header mirrors the real page's
// `pt-6 pb-4` wrapper + <Breadcrumbs> + <PageHeader> so nothing shifts.
export default function CategoryLoading() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 pb-3 sticky-header-bg">
        <SkeletonBreadcrumbs segments={3} />
        {/* The description line is the category's description. */}
        <SkeletonPageHeader
          titleWidth="w-56"
          descriptionWidth="w-[32rem] max-w-full"
          descriptionLinesOnPhone={2}
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
            those pages.

            On a phone most departments wrap their chips to two rows; the last
            chip is hidden there so the spread wraps to two rows as well. */}
        <div className="flex flex-wrap gap-2 mt-2">
          {["w-24", "w-40", "w-32", "w-20", "w-20", "w-28"].map((w, i, all) => (
            <Skeleton
              key={i}
              className={cn("h-7.5 rounded-full", w, i === all.length - 1 && "hidden sm:block")}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col flex-1 min-h-0 gap-4">
        {/* PublicProductsPage: toolbar + the collapsed active-filter row in a
            flex-col gap-2 - the empty row still takes its 8px gap. */}
        <div className="shrink-0 px-6 flex flex-col gap-2">
          <SkeletonSearchToolbar />
          <SkeletonActiveFiltersSpacer />
        </div>
        <ScrollArea layout="column" className="flex-1 min-h-0">
          <div className="flex gap-6 flex-1 px-6">
            <SkeletonFilterSidebar groups={["range", "rating", 2, 2, 8]} />
            <div className="flex-1 min-w-0">
              <SkeletonProductGrid />
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
