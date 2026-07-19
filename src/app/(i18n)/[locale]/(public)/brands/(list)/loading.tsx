import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Footer } from "@/components/layout/footer";
import { Skeleton, SkeletonArray, SkeletonBreadcrumbs, SkeletonText } from "@/components/ui/skeleton";

export default async function BrandsLoading() {
  const t = await getTranslations("brands");
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs width="w-40" />
        <PageHeader
          title={t("publicTitle")}
          description={t("publicDescription")}
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="flex-1 px-6 pb-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <SkeletonArray amount={10}>
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/50 bg-card p-6">
                <Skeleton className="h-16 w-16 rounded-xl" />
                <div className="flex flex-col items-center gap-1.5">
                  <SkeletonText rows={1} size="md" className="w-24" />
                  <SkeletonText rows={1} size="sm" className="w-16" />
                </div>
              </div>
            </SkeletonArray>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
