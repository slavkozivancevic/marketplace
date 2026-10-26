import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SkeletonBreadcrumbs } from "@/components/ui/skeleton";
import { PriceMarketFormSkeleton } from "@/features/priceMarkets/components/PriceMarketFormSkeleton";

export default async function NewPriceMarketLoading() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        {/* admin / price markets / new */}
        <SkeletonBreadcrumbs segments={3} />
        <PageHeader title={t("admin.createPriceMarket")} description={t("admin.createPriceMarketDesc")}>
          <Button asChild variant="outline">
            <Link href="/admin/price-markets">{t("admin.backToPriceMarkets")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <PriceMarketFormSkeleton />
      </div>
    </div>
  );
}
