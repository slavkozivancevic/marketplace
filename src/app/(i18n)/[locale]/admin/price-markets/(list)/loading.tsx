import { Link, getPathname } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { PriceMarketTableSkeleton } from "@/features/priceMarkets/components/PriceMarketTableSkeleton";

/** Real shell, skeleton body only - see the note in ../../brands/(list)/loading.tsx. */
export default async function AdminPriceMarketsLoading() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminPriceMarkets"), href: getPathname({ href: "/admin/price-markets", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("admin.priceMarkets")} description={t("admin.priceMarketsManage")}>
          <Button asChild>
            <Link href="/admin/price-markets/new">{t("admin.addPriceMarket")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <PriceMarketTableSkeleton />
      </div>
    </div>
  );
}
