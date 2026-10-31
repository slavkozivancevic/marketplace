import { ScrollArea } from "@/components/ui/scroll-area";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import {
  SkeletonBreadcrumbs,
  SkeletonFilterSidebar,
  SkeletonProductGrid,
  SkeletonSearchToolbar,
  SkeletonActiveFiltersSpacer,
} from "@/components/ui/skeleton";

export default async function ProductsLoading() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs />
        <PageHeader title={t("products.title")} description={t("products.browse")} />
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
