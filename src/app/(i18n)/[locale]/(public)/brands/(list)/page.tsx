import type { Metadata } from "next";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/core/db/prisma";
import { Link, getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getBrandName } from "@/features/brands/utils/translations";
import { CacheTags } from "@/lib/cache/tags";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Footer } from "@/components/layout/footer";
import { absoluteUrl } from "@/lib/seo/jsonLd";
import { BrandLogo, type LogoBackdrop } from "@/features/brands/components/BrandLogo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // Route segment, not getLocale() - see the products list page for why.
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "brands" });

  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = absoluteUrl(getPathname({ href: "/brands", locale: l }));
  }

  return {
    title: t("publicTitle"),
    description: t("publicDescription"),
    alternates: { canonical: languages[locale], languages },
    openGraph: {
      title: t("publicTitle"),
      description: t("publicDescription"),
      locale,
      type: "website",
    },
  };
}

type BrandCard = {
  id: string;
  logoUrl: string | null;
  logoUrlDark: string | null;
  logoBackdrop: LogoBackdrop;
  logoBackdropDark: LogoBackdrop;
  name: string;
  slug: string;
  productCount: number;
};

/**
 * Public brand directory. Loads every brand with all its translation rows
 * (no header reads inside `"use cache"`), then the caller picks the
 * locale-specific row at render time. `cacheTag(brands.all)` invalidation
 * already runs on brand create/update via the admin repo.
 */
async function fetchAllBrandsRaw() {
  "use cache";
  cacheTag(CacheTags.brands.all());
  cacheTag(CacheTags.products.publicAll());

  return prisma.brand.findMany({
    select: {
      id: true,
      logoUrl: true,
      logoUrlDark: true,
      logoBackdrop: true,
      logoBackdropDark: true,
      translations: { select: { locale: true, name: true, slug: true } },
      _count: {
        select: {
          products: {
            where: { status: "PUBLISHED", deletedAt: null },
          },
        },
      },
    },
  });
}

export default async function BrandsPage() {
  const locale = await getLocale();
  const t = await getTranslations("brands");
  const tCrumbs = await getTranslations("breadcrumbs");
  const rawBrands = await fetchAllBrandsRaw();

  const breadcrumbItems = [
    { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
    { name: tCrumbs("brands"), href: getPathname({ href: "/brands", locale }) },
  ];

  const brands: BrandCard[] = rawBrands
    .map((b) => {
      // `row` is only for the SLUG - that must stay this locale's own URL.
      // The NAME goes through `getBrandName`, because a locale can have a
      // translation row whose name was left blank (kept alive by its
      // slug/description) and the card would then render an empty label.
      const row =
        b.translations.find((tr) => tr.locale === locale) ??
        b.translations.find((tr) => tr.locale === routing.defaultLocale) ??
        b.translations[0];
      if (!row) return null;
      return {
        id: b.id,
        logoUrl: b.logoUrl,
        logoUrlDark: b.logoUrlDark,
        logoBackdrop: b.logoBackdrop,
        logoBackdropDark: b.logoBackdropDark,
        name: getBrandName(b, locale),
        slug: row.slug,
        productCount: b._count.products,
      };
    })
    .filter((b): b is BrandCard => b !== null && b.productCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} />
        <PageHeader
          title={t("publicTitle")}
          description={t("publicDescription")}
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="flex-1 px-6 pb-6">
          {brands.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              {t("publicEmpty")}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {brands.map((b) => (
                <Link
                  key={b.id}
                  href={{
                    pathname: "/brands/[slug]",
                    params: { slug: b.slug },
                  }}
                  className="group flex flex-col items-center justify-center gap-3 rounded-xl border border-border/50 bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 hover:border-border"
                >
                  <BrandLogo
                    src={b.logoUrl}
                    srcDark={b.logoUrlDark}
                    backdrop={b.logoBackdrop}
                    backdropDark={b.logoBackdropDark}
                    name={b.name}
                    size={64}
                  />
                  <div className="text-center">
                    <p className="text-sm font-semibold truncate max-w-35">
                      {b.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("publicProductCount", { count: b.productCount })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <Footer />
      </div>
    </div>
  );
}
