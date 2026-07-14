import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import {
  SkeletonArray,
  SkeletonBreadcrumbs,
  SkeletonFilterSidebar,
  SkeletonProductGridCard,
  SkeletonSearchToolbar,
} from "@/components/ui/skeleton";

export default async function ProductsLoading() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2">
        <SkeletonBreadcrumbs width="w-40" />
        <PageHeader title={t("products.title")} description={t("products.browse")} />
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
