import type { Metadata } from "next";
import { cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { VALID_CURRENCIES } from "@/lib/currency-config";

import { prisma } from "@/core/db/prisma";
import { Link, getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCategoryName } from "@/features/categories/utils/translations";
import { CacheTags } from "@/lib/cache/tags";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { absoluteUrl } from "@/lib/seo/jsonLd";
import { Footer } from "@/components/layout/footer";
import { PublicProductsPage } from "@/features/products/components/PublicProductsPage";
import { PublishLocalePaths, type LocalePaths } from "@/i18n/LocalePathsContext";
import type { Locale } from "@/i18n/config";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { getAllBrands } from "@/features/brands/db/brands";
import { getAllTags } from "@/features/tags/db/tags";
import {
  getCategoryTree,
  getDescendantIds,
} from "@/features/categories/db/categories";
import { getPublicProductsPage } from "@/features/products/db/publicProducts";
import { GRID_PAGE_SIZE } from "@/constants/queryConstants";

// Matches a v4 UUID - used to redirect legacy `/categories/<uuid>` URLs to
// the locale-correct slug form.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CategoryPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

/**
 * Looks up a category by slug WITHOUT requiring a locale match. The
 * `CategoryTranslation` table is unique on `(locale, slug)`, but a
 * visitor on `/sr/kategorije/<en-slug>` (typed URL, stale share link,
 * cross-language crawler) should land on the category page, not a 404.
 * The page layer then redirects to the locale-correct canonical URL or
 * falls back to the default-locale translation.
 */
async function fetchCategoryBySlugAnyLocale(slug: string) {
  "use cache";
  cacheTag(CacheTags.categories.all());

  const translationRow = await prisma.categoryTranslation.findFirst({
    where: { slug },
    select: { categoryId: true },
  });
  if (!translationRow) return null;

  cacheTag(CacheTags.categories.byId(translationRow.categoryId));

  return prisma.category.findUnique({
    where: { id: translationRow.categoryId },
    include: {
      translations: true,
      parent: { select: { id: true, translations: true } },
      children: {
        where: { isActive: true },
        select: { id: true, translations: true },
      },
    },
  });
}

/**
 * Picks the first published product image under this category branch to
 * use as the OG share thumbnail. Runs as its own cached fetch keyed on
 * the category id so the parent metadata function stays cache-eligible.
 */
async function fetchCategoryShareImage(categoryId: string) {
  "use cache";
  cacheTag(CacheTags.categories.byId(categoryId));
  cacheTag(CacheTags.products.publicAll());
  const product = await prisma.product.findFirst({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      categories: { some: { categoryId } },
    },
    orderBy: [
      { featuredAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    select: {
      media: {
        take: 1,
        orderBy: { order: "asc" },
        where: { mediaType: "IMAGE" },
        select: { url: true },
      },
    },
  });
  return product?.media[0]?.url ?? null;
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

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = await fetchCategoryBySlugAnyLocale(slug);
  if (!category) return {};

  const localT =
    category.translations.find((tr) => tr.locale === locale) ??
    category.translations.find((tr) => tr.locale === routing.defaultLocale);
  // Name goes through `getCategoryName`, not `localT.name`: this locale can
  // HAVE a translation row whose name was left blank (the row is kept alive
  // by its slug/description), and reading the row directly would title the
  // page with an empty string instead of falling back to English.
  const categoryName = getCategoryName(category, locale);

  const languages: Record<string, string> = {};
  for (const tr of category.translations) {
    languages[tr.locale] = absoluteUrl(
      getPathname({
        href: { pathname: "/categories/[slug]", params: { slug: tr.slug } },
        locale: tr.locale as (typeof routing.locales)[number],
      }),
    );
  }
  // x-default points crawlers at the default-locale URL when no language fits.
  languages["x-default"] = languages[routing.defaultLocale] ?? languages[locale];

  const ogImage = category.imageUrl ?? (await fetchCategoryShareImage(category.id));

  // Most categories have no curated description; fall back to a templated one
  // so the SERP snippet and social cards aren't blank.
  const t = await getTranslations({ locale, namespace: "categories" });
  const description =
    localT?.description ??
    (categoryName ? t("metaDescriptionFallback", { name: categoryName }) : undefined);

  return {
    title: categoryName,
    description,
    alternates: {
      canonical: languages[locale] ?? languages[routing.defaultLocale],
      languages,
    },
    openGraph: {
      title: categoryName,
      description,
      locale,
      type: "website",
      images: ogImage ? [{ url: ogImage, alt: categoryName }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: categoryName,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function CategoryDetailPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const locale = await getLocale();

  if (UUID_RE.test(slug)) {
    const slugRow = await prisma.categoryTranslation.findFirst({
      where: { categoryId: slug, locale },
      select: { slug: true },
    });
    const fallback =
      slugRow ??
      (await prisma.categoryTranslation.findFirst({
        where: { categoryId: slug, locale: routing.defaultLocale },
        select: { slug: true },
      }));
    if (fallback) {
      permanentRedirect(
        getPathname({
          href: { pathname: "/categories/[slug]", params: { slug: fallback.slug } },
          locale,
        }),
      );
    }
    notFound();
  }

  const category = await fetchCategoryBySlugAnyLocale(slug);
  if (!category) notFound();

  const localTranslation = category.translations.find((tr) => tr.locale === locale);
  if (localTranslation && localTranslation.slug !== slug) {
    permanentRedirect(
      getPathname({
        href: { pathname: "/categories/[slug]", params: { slug: localTranslation.slug } },
        locale,
      }),
    );
  }

  const localT =
    localTranslation ??
    category.translations.find((tr) => tr.locale === routing.defaultLocale) ??
    category.translations[0];
  // See generateMetadata: a present row does not guarantee a non-blank name,
  // so headings and breadcrumbs read through `getCategoryName`. Slugs still
  // come from the rows themselves - those are per-locale URLs, never blank.
  const categoryName = getCategoryName(category, locale);
  const t = await getTranslations("categories");
  const tCrumbs = await getTranslations("breadcrumbs");

  const homePath = getPathname({ href: "/", locale });
  const productsListPath = getPathname({ href: "/products", locale });
  const currentPath = getPathname({
    href: { pathname: "/categories/[slug]", params: { slug } },
    locale,
  });
  const parent = category.parent;
  // `parentT` supplies the crumb's per-locale SLUG; the label comes from
  // `getCategoryName` for the same blank-name reason as above.
  const parentT = parent
    ? parent.translations.find((tr) => tr.locale === locale) ??
      parent.translations.find((tr) => tr.locale === routing.defaultLocale)
    : null;
  const parentName = parent ? getCategoryName(parent, locale) : "";
  const breadcrumbItems = [
    { name: tCrumbs("home"), href: homePath },
    { name: tCrumbs("products"), href: productsListPath },
    ...(parentT
      ? [{
          name: parentName,
          href: getPathname({
            href: { pathname: "/categories/[slug]", params: { slug: parentT.slug } },
            locale,
          }),
        }]
      : []),
    { name: categoryName, href: currentPath },
  ];

  const localePaths: LocalePaths = {};
  for (const tr of category.translations) {
    localePaths[tr.locale as Locale] = getPathname({
      href: { pathname: "/categories/[slug]", params: { slug: tr.slug } },
      locale: tr.locale as (typeof routing.locales)[number],
    });
  }

  // Prefetch the first page so server-rendered HTML already contains
  // products (SEO + perceived speed). Locked dept pins the category
  // branch in the catalog grid; the API resolves the slug to the same
  // descendant ID set we'd compute manually for the closure walk.
  const [queryClient, brands, categoryTree, tags] = await Promise.all([
    Promise.resolve(getQueryClient()),
    fetchBrands(),
    fetchCategoryTree(),
    fetchTags(),
  ]);

  const deptSlug = localT?.slug ?? slug;
  const deptCategoryIds = getDescendantIds(categoryTree, deptSlug);

  const lockedFilters = {
    search: "",
    sortBy: "createdAt" as const,
    sortOrder: "desc" as const,
    minPrice: null,
    maxPrice: null,
    onSale: null,
    bestseller: null,
    isDigital: null,
    minWarranty: null,
    origin: [] as string[],
    brandId: [] as string[],
    tagId: [] as string[],
    minRating: null,
    dept: deptSlug,
    attrs: "",
  };

  // Currency must be in the key so the SSR prefetch matches the client grid's
  // query key (which includes it) - otherwise hydration seeds a different cache
  // entry and the list stays stale until a full reload.
  const rawCurrency = (await cookies()).get("NEXT_CURRENCY")?.value;
  const currency = VALID_CURRENCIES.includes(rawCurrency as never)
    ? rawCurrency!
    : "usd";

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["products", "public", lockedFilters, currency, locale],
    queryFn: () =>
      getPublicProductsPage({
        take: GRID_PAGE_SIZE,
        searchLocale: locale,
        sortBy: lockedFilters.sortBy,
        sortOrder: lockedFilters.sortOrder,
        categoryId: deptCategoryIds.length ? deptCategoryIds : undefined,
      }),
    initialPageParam: undefined as string | undefined,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PublishLocalePaths paths={localePaths} />

      <div className="shrink-0 px-6 pt-2 pb-3 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} />
        <PageHeader
          title={categoryName}
          description={localT?.description ?? undefined}
        >
          <Button asChild variant="outline">
            <Link href="/products">{t("publicBackToShop")}</Link>
          </Button>
        </PageHeader>

        {/* Subcategory chips - only render when this is a parent category
            with active children, so leaf categories don't show an empty row. */}
        {category.children.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {category.children.map((child) => {
              const childT =
                child.translations.find((tr) => tr.locale === locale) ??
                child.translations.find((tr) => tr.locale === routing.defaultLocale);
              if (!childT) return null;
              return (
                <Link
                  key={child.id}
                  href={{
                    pathname: "/categories/[slug]",
                    params: { slug: childT.slug },
                  }}
                  className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                >
                  {getCategoryName(child, locale)}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Identical to /products - same grid, sidebar and department selector -
          only pre-scoped to this category. The dept selector stays usable so
          visitors can jump to another department from here. */}
      <div className="flex-1 flex flex-col min-h-0">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <PublicProductsPage
            brands={brands}
            categoryTree={categoryTree}
            tags={tags}
            footer={<Footer />}
            currentDept={deptSlug}
          />
        </HydrationBoundary>
      </div>
    </div>
  );
}
