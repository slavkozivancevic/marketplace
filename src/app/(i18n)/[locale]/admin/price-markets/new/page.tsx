import { Link, getPathname } from "@/i18n/navigation";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getAllPriceMarkets } from "@/features/priceMarkets/db/markets";
import { getPriceMarketName } from "@/features/priceMarkets/utils/markets";
import { PriceMarketForm } from "@/features/priceMarkets/components/PriceMarketForm";

export default async function NewPriceMarketPage() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const markets = await fetchPriceMarkets();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminPriceMarkets"), href: getPathname({ href: "/admin/price-markets", locale }) },
    { name: tCrumbs("newPriceMarket"), href: getPathname({ href: "/admin/price-markets/new", locale }) },
  ];

  // Every country already in a market is taken for a new one.
  const takenBy: Record<string, string> = {};
  for (const m of markets) for (const c of m.countries) takenBy[c] = getPriceMarketName(m, locale);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("admin.createPriceMarket")} description={t("admin.createPriceMarketDesc")}>
          <Button asChild variant="outline">
            <Link href="/admin/price-markets">{t("admin.backToPriceMarkets")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <PriceMarketForm mode="create" takenBy={takenBy} />
      </div>
    </div>
  );
}

async function fetchPriceMarkets() {
  "use cache";
  cacheTag(CacheTags.priceMarkets.all());
  return getAllPriceMarkets();
}
