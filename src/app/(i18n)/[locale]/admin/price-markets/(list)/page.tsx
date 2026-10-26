import { Link, getPathname } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { getAllPriceMarkets } from "@/features/priceMarkets/db/markets";
import { AdminPriceMarketsPage } from "@/features/priceMarkets/components/AdminPriceMarketsPage";

export default async function AdminPriceMarketsRoute() {
  await connection();
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  // Read live, not through `"use cache"`: the rule count on each row (which
  // decides whether delete is blocked) changes whenever a SELLER adds or removes
  // a market rule, and seller rule writes invalidate product tags, not this
  // list. One small query on an admin page beats a delete dialog that says
  // "nothing uses this" right before the server refuses it.
  const markets = await getAllPriceMarkets();
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
        <AdminPriceMarketsPage markets={markets} />
      </div>
    </div>
  );
}
