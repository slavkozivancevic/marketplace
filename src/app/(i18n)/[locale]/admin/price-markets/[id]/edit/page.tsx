import { Link, getPathname } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { RemountOnNavigation } from "@/components/forms/RemountOnNavigation";
import { DEFAULT_LOCALE, NON_DEFAULT_LOCALES } from "@/i18n/config";
import { getAllPriceMarkets, getPriceMarketById } from "@/features/priceMarkets/db/markets";
import { getPriceMarketName } from "@/features/priceMarkets/utils/markets";
import { PriceMarketForm } from "@/features/priceMarkets/components/PriceMarketForm";
import type { PriceMarketInput } from "@/features/priceMarkets/schema/priceMarkets";

export default async function EditPriceMarketPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const { id } = await params;
  const [market, all] = await Promise.all([fetchPriceMarket(id), fetchPriceMarkets()]);

  if (!market) notFound();

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminPriceMarkets"), href: getPathname({ href: "/admin/price-markets", locale }) },
    {
      name: tCrumbs("editPriceMarket"),
      href: getPathname({ href: { pathname: "/admin/price-markets/[id]/edit", params: { id } }, locale }),
    },
  ];

  // Every locale gets an entry, empty where no row exists: a missing key leaves
  // the field's default `undefined`, and typing then clearing it would never
  // read as unchanged again. Same trap the tag and trust-point pages document.
  const translations: NonNullable<PriceMarketInput["translations"]> = {};
  for (const loc of NON_DEFAULT_LOCALES) {
    translations[loc] = { name: market.translations.find((tr) => tr.locale === loc)?.name ?? "" };
  }

  // Countries owned by the OTHER markets; this one's own stay pickable.
  const takenBy: Record<string, string> = {};
  for (const m of all) {
    if (m.id === market.id) continue;
    for (const c of m.countries) takenBy[c] = getPriceMarketName(m, locale);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("admin.editPriceMarket", { name: getPriceMarketName(market, locale) })}
          description={t("admin.editPriceMarketDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/admin/price-markets">{t("admin.backToPriceMarkets")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        {/* Remounts only on navigating away and back - never per render, which
            would tear the form down mid-save on every revalidation. */}
        <RemountOnNavigation>
          <PriceMarketForm
            mode="edit"
            marketId={market.id}
            isDefault={market.isDefault}
            takenBy={takenBy}
            defaultValues={{
              name: market.translations.find((tr) => tr.locale === DEFAULT_LOCALE)?.name ?? "",
              translations,
              countries: market.countries,
            }}
          />
        </RemountOnNavigation>
      </div>
    </div>
  );
}

async function fetchPriceMarket(id: string) {
  "use cache";
  cacheTag(CacheTags.priceMarkets.byId(id));
  return getPriceMarketById(id);
}

async function fetchPriceMarkets() {
  "use cache";
  cacheTag(CacheTags.priceMarkets.all());
  return getAllPriceMarkets();
}
