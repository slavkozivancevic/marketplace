import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SkeletonBreadcrumbs } from "@/components/ui/skeleton";
import { PriceMarketFormSkeleton } from "@/features/priceMarkets/components/PriceMarketFormSkeleton";

/** Name-less title: the record is exactly what is still loading. */
export default async function EditPriceMarketLoading() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        {/* admin / price markets / edit */}
        <SkeletonBreadcrumbs segments={3} />
        <PageHeader title={t("admin.editPriceMarketLoading")} description={t("admin.editPriceMarketDesc")}>
          <Button asChild variant="outline">
            <Link href="/admin/price-markets">{t("admin.backToPriceMarkets")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <PriceMarketFormSkeleton mode="edit" />
      </div>
    </div>
  );
}
