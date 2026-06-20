import type { Metadata } from "next";
import { cacheTag } from "next/cache";
import { notFound, permanentRedirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { prisma } from "@/core/db/prisma";
import { Link, getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { CacheTags } from "@/lib/cache/tags";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { absoluteUrl } from "@/lib/seo/jsonLd";
import { Footer } from "@/components/layout/footer";
import { BrandLogo } from "@/features/brands/components/BrandLogo";
import { PublicProductsPage } from "@/features/products/components/PublicProductsPage";
import { PublishLocalePaths, type LocalePaths } from "@/i18n/LocalePathsContext";
import type { Locale } from "@/i18n/config";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { getAllBrands } from "@/features/brands/db/brands";
import { getCategoryTree } from "@/features/categories/db/categories";
import { getPublicProductsPage } from "@/features/products/db/publicProducts";
import { GRID_PAGE_SIZE } from "@/constants/queryConstants";

// Matches a v4 UUID - used to redirect legacy `/brands/<uuid>` URLs to the
// slug form, mirroring the same UUID-redirect contract we have for products.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BrandPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

/**
 * Looks up a brand by slug WITHOUT requiring a locale match. The
 * `BrandTranslation` table is unique on `(locale, slug)`, but the same
 * brand may legitimately have a different slug per locale, so a visitor
 * landing on `/sr/brendovi/<en-slug>` (typed URL, stale share link,
 * incoming crawler with the wrong slug) must NOT 404 - the slug exists,
 * just not for the locale they're viewing in.
 *
 * The page layer then decides whether to redirect to the locale-correct
 * canonical URL or render with the brand's default-locale fallback
 * content.
 */
async function fetchBrandBySlugAnyLocale(slug: string) {
  "use cache";
  cacheTag(CacheTags.brands.all());

  const translationRow = await prisma.brandTranslation.findFirst({
    where: { slug },
    select: { brandId: true },
  });
  if (!translationRow) return null;

  cacheTag(CacheTags.brands.byId(translationRow.brandId));

  return prisma.brand.findUnique({
    where: { id: translationRow.brandId },
    include: { translations: true },
  });
}

async function fetchBrands() {
  "use cache";
  cacheTag(CacheTags.brands.all());
  return getAllBrands();
}

async function fetchCategoryTree() {
  "use cache";
  cacheTag(CacheTags.categories.all());
  return getCategoryTree();
}

export async function generateMetadata({
  params,
}: BrandPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const brand = await fetchBrandBySlugAnyLocale(slug);
  if (!brand) return {};

  const localT =
    brand.translations.find((tr) => tr.locale === locale) ??
    brand.translations.find((tr) => tr.locale === routing.defaultLocale);

  const languages: Record<string, string> = {};
  for (const tr of brand.translations) {
    languages[tr.locale] = absoluteUrl(
      getPathname({
        href: { pathname: "/brands/[slug]", params: { slug: tr.slug } },
        locale: tr.locale as (typeof routing.locales)[number],
      }),
    );
  }
  // x-default points crawlers at the default-locale URL when no language fits.
  languages["x-default"] = languages[routing.defaultLocale] ?? languages[locale];

  return {
    title: localT?.name,
    description: localT?.description ?? undefined,
    alternates: {
      canonical: languages[locale] ?? languages[routing.defaultLocale],
      languages,
    },
    openGraph: {
      title: localT?.name,
      description: localT?.description ?? undefined,
      locale,
      type: "website",
      images: brand.logoUrl
        ? [{ url: brand.logoUrl, alt: localT?.name ?? "" }]
        : undefined,
    },
    twitter: {
      card: brand.logoUrl ? "summary_large_image" : "summary",
      title: localT?.name,
      description: localT?.description ?? undefined,
      images: brand.logoUrl ? [brand.logoUrl] : undefined,
    },
  };
}

export default async function BrandDetailPage({ params }: BrandPageProps) {
  const { slug } = await params;
  const locale = await getLocale();

  // Legacy `/brands/<uuid>` URLs: 308-redirect to the locale-correct slug.
  if (UUID_RE.test(slug)) {
    const slugRow = await prisma.brandTranslation.findFirst({
      where: { brandId: slug, locale },
      select: { slug: true },
    });
    const fallback =
      slugRow ??
      (await prisma.brandTranslation.findFirst({
        where: { brandId: slug, locale: routing.defaultLocale },
        select: { slug: true },
      }));
    if (fallback) {
      permanentRedirect(
        getPathname({
          href: { pathname: "/brands/[slug]", params: { slug: fallback.slug } },
          locale,
        }),
      );
    }
    notFound();
  }

  const brand = await fetchBrandBySlugAnyLocale(slug);
  if (!brand) notFound();

  // Slug came from another locale - 308 to this locale's canonical slug.
  const localTranslation = brand.translations.find((tr) => tr.locale === locale);
  if (localTranslation && localTranslation.slug !== slug) {
    permanentRedirect(
      getPathname({
        href: { pathname: "/brands/[slug]", params: { slug: localTranslation.slug } },
        locale,
      }),
    );
  }

  const localT =
    localTranslation ??
    brand.translations.find((tr) => tr.locale === routing.defaultLocale) ??
    brand.translations[0];
  const t = await getTranslations("brands");
  const tCrumbs = await getTranslations("breadcrumbs");

  const brandPath = getPathname({
    href: { pathname: "/brands/[slug]", params: { slug } },
    locale,
  });
  const homePath = getPathname({ href: "/", locale });
  const brandsListPath = getPathname({ href: "/brands", locale });
  const breadcrumbItems = [
    { name: tCrumbs("home"), href: homePath },
    { name: tCrumbs("brands"), href: brandsListPath },
    { name: localT?.name ?? "", href: brandPath },
  ];

  // Per-locale URLs of this brand so the language switcher hops straight
  // to e.g. `/sr/brendovi/<sr-slug>` instead of reusing the English slug.
  const localePaths: LocalePaths = {};
  for (const tr of brand.translations) {
    localePaths[tr.locale as Locale] = getPathname({
      href: { pathname: "/brands/[slug]", params: { slug: tr.slug } },
      locale: tr.locale as (typeof routing.locales)[number],
    });
  }

  // Hydrate the first product page server-side so the initial HTML
  // already contains real products (SEO + perceived speed) instead of
  // skeletons. The client useInfiniteQuery picks up from this snapshot.
  const [queryClient, brands, categoryTree] = await Promise.all([
    Promise.resolve(getQueryClient()),
    fetchBrands(),
    fetchCategoryTree(),
  ]);

  const lockedFilters = {
    search: "",
    sortBy: "createdAt" as const,
    sortOrder: "desc" as const,
    minPrice: null,
    maxPrice: null,
    onSale: null,
    isDigital: null,
    brandId: [brand.id],
    minRating: null,
    dept: "",
    attrs: "",
  };

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["products", "public", lockedFilters],
    queryFn: () =>
      getPublicProductsPage({
        take: GRID_PAGE_SIZE,
        sortBy: lockedFilters.sortBy,
        sortOrder: lockedFilters.sortOrder,
        brandId: lockedFilters.brandId,
      }),
    initialPageParam: undefined as string | undefined,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PublishLocalePaths paths={localePaths} />

      {/* Hero strip - logo + name + back button, sits above the
          catalog's own search bar / sidebar. */}
      <div className="shrink-0 px-6 pt-6 pb-4">
        <Breadcrumbs items={breadcrumbItems} />
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mt-3">
          <div className="flex items-center gap-4 min-w-0">
            <BrandLogo
              src={brand.logoUrl}
              srcDark={brand.logoUrlDark}
              backdrop={brand.logoBackdrop}
              backdropDark={brand.logoBackdropDark}
              name={localT?.name ?? ""}
              size={64}
            />
            <div className="space-y-0.5 min-w-0">
              <h1 className="text-2xl font-bold text-foreground truncate">
                {localT?.name ?? ""}
              </h1>
              {localT?.description && (
                <p className="text-sm text-muted-foreground">
                  {localT.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild variant="outline">
              <Link href="/brands">{t("publicBackToBrands")}</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Catalog with brandId pinned to this brand. Same infinite-scroll
          virtualized grid, search, sort and filter sidebar as the main
          /products page - the only thing missing is the brand filter
          group itself (pointless when the route already pins it). */}
      <div className="flex-1 flex flex-col min-h-0">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <PublicProductsPage
            brands={brands}
            categoryTree={categoryTree}
            footer={<Footer />}
            lockedBrandId={brand.id}
          />
        </HydrationBoundary>
      </div>
    </div>
  );
}
