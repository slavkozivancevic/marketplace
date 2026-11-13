import { ScrollArea } from "@/components/ui/scroll-area";
import { CategoryHeaderSkeleton } from "@/features/categories/components/CategoryHeaderSkeleton";
import {
  SkeletonFilterSidebar,
  SkeletonProductGrid,
  SkeletonSearchToolbar,
  SkeletonActiveFiltersSpacer,
} from "@/components/ui/skeleton";

// The header comes from the layout's category tree (see CategoryHeaderSkeleton);
// below it, the same toolbar, sidebar and grid placeholders as /products.
export default function CategoryLoading() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <CategoryHeaderSkeleton />
      <div className="flex flex-col flex-1 min-h-0 gap-4">
        {/* PublicProductsPage: toolbar + the collapsed active-filter row in a
            flex-col gap-2 - the empty row still takes its 8px gap. */}
        <div className="shrink-0 px-6 flex flex-col gap-2">
          <SkeletonSearchToolbar />
          <SkeletonActiveFiltersSpacer />
        </div>
        <ScrollArea layout="column" className="flex-1 min-h-0">
          <div className="flex gap-6 flex-1 px-6">
            <SkeletonFilterSidebar groups={["priceRange", "rating", 2, 2, 5, 8, 8]} />
            <div className="flex-1 min-w-0">
              <SkeletonProductGrid />
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
