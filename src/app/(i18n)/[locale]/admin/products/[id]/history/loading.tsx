import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonBreadcrumbs, SkeletonButton } from "@/components/ui/skeleton";
import { ProductHistoryTableSkeleton } from "@/features/products/components/ProductHistoryTableSkeleton";

export default async function ProductHistoryLoadingPage() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs segments={4} />
        <PageHeader
          title={t("admin.productHistory")}
          description={t("admin.loadingHistory")}
        >
          <SkeletonButton className="w-28" />
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <ProductHistoryTableSkeleton />
      </div>
    </div>
  );
}
