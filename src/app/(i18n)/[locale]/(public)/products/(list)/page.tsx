import type { Metadata } from "next";
import { cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { VALID_CURRENCIES } from "@/lib/currency-config";
import { decimalToCents } from "@/lib/currency";
import { getCurrencyRate } from "@/features/currency/db/currencyRates";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createSearchParamsCache } from "nuqs/server";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { getPublicProductsPage } from "@/features/products/db/publicProducts";
import { productSearchParams } from "@/lib/query/searchParams";
import { parseAttrs } from "@/lib/query/attrs";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { PublicProductsPage } from "@/features/products/components/PublicProductsPage";
import { Footer } from "@/components/layout/footer";
import { CacheTags } from "@/lib/cache/tags";
import { getAllBrands } from "@/features/brands/db/brands";
import { getAllTags } from "@/features/tags/db/tags";
import {
  getCategoryTree,
  getDescendantIds,
} from "@/features/categories/db/categories";
import { GRID_PAGE_SIZE } from "@/constants/queryConstants";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { absoluteUrl } from "@/lib/seo/jsonLd";

const searchParamsCache = createSearchParamsCache(productSearchParams);

/**
 * Listing-page metadata. Canonical points at the locale's URL for the
 * bare catalog (no filter params) so search params don't fracture the
 * canonical index across thousands of filter combinations. hreflang
 * mirrors the canonical across locales for shared discovery weight.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "products" });

  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    languages[l] = absoluteUrl(getPathname({ href: "/products", locale: l }));
  }
  // Tell Google which URL to serve when no locale matches the visitor.
  languages["x-default"] = languages[routing.defaultLocale];

  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: {
      canonical: languages[locale],
      languages,
    },
    openGraph: {
      title: t("title"),
      description: t("metaDescription"),
      locale,
      type: "website",
      images: [
        { url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: t("title") },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("metaDescription"),
      images: [absoluteUrl("/api/og")],
    },
  };
}

export default async function ProductsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const params = searchParamsCache.parse(await searchParams);

  // The client grid's query key includes the active currency (its fetcher bakes
  // rate-converted price bounds into the request), so the SSR prefetch key MUST
  // include it too - otherwise the prefetch seeds a different cache entry and
  // hydration never carries fresh data into the grid's query, leaving the list
  // stale until a full reload. Read the same NEXT_CURRENCY cookie the currency
  // store is seeded from and coerce it identically (invalid/absent -> "usd").
  const rawCurrency = (await cookies()).get("NEXT_CURRENCY")?.value;
  const currency = VALID_CURRENCIES.includes(rawCurrency as never)
    ? rawCurrency!
    : "usd";

  const breadcrumbItems = [
    { name: tCrumbs("home"), href: getPathname({ href: "/", locale }) },
    { name: tCrumbs("products"), href: getPathname({ href: "/products", locale }) },
  ];

  const [queryClient, brands, categoryTree, tags] = await Promise.all([
    Promise.resolve(getQueryClient()),
    fetchBrands(),
    fetchCategoryTree(),
    fetchTags(),
  ]);

  // Resolve dept slug → descendant IDs for the SSR prefetch
  const deptCategoryIds = params.dept
    ? getDescendantIds(categoryTree, params.dept)
    : undefined;

  // Price bounds in the URL are in the buyer's display currency (what the user
  // typed). The DB stores prices in USD cents, so the SSR prefetch must apply
  // the exact same pipeline the client grid + API do: divide by the rate
  // (display → USD), then decimalToCents (USD → cents). Skip the rate lookup
  // entirely when no price filter is active.
  const rate =
    params.minPrice != null || params.maxPrice != null
      ? await getCurrencyRate(currency)
      : 1;
  const minPriceCents =
    params.minPrice != null ? decimalToCents(params.minPrice / rate) : undefined;
  const maxPriceCents =
    params.maxPrice != null ? decimalToCents(params.maxPrice / rate) : undefined;

  const filters = {
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    onSale: params.onSale,
    bestseller: params.bestseller,
    isDigital: params.isDigital,
    brandId: params.brandId,
    tagId: params.tagId,
    minRating: params.minRating,
    dept: params.dept,
    attrs: params.attrs,
  };

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["products", "public", filters, currency, locale],
    queryFn: () =>
      getPublicProductsPage({
        take: GRID_PAGE_SIZE,
        search: filters.search || undefined,
        searchLocale: locale,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        minPrice: minPriceCents,
        maxPrice: maxPriceCents,
        onSale: filters.onSale,
        bestseller: filters.bestseller,
        isDigital: filters.isDigital,
        brandId: filters.brandId.length ? filters.brandId : undefined,
        tagId: filters.tagId.length ? filters.tagId : undefined,
        minRating: filters.minRating ?? undefined,
        categoryId: deptCategoryIds?.length ? deptCategoryIds : undefined,
        attributeFilters: parseAttrs(filters.attrs),
      }),
    initialPageParam: undefined as string | undefined,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} />
        <PageHeader
          title={t("products.title")}
          description={t("products.browse")}
        />
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <PublicProductsPage
            brands={brands}
            categoryTree={categoryTree}
            tags={tags}
            footer={<Footer />}
          />
        </HydrationBoundary>
      </div>
    </div>
  );
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

async function fetchTags() {
  "use cache";
  cacheTag(CacheTags.tags.all());
  return getAllTags();
}