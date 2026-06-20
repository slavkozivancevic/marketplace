import type { Metadata } from "next";
import { cacheTag } from "next/cache";
import { notFound, permanentRedirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { prisma } from "@/core/db/prisma";
import { Link, getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { CacheTags } from "@/lib/cache/tags";
import { SerializedPublicProduct } from "@/types/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { absoluteUrl, productJsonLd } from "@/lib/seo/jsonLd";
import { PublishLocalePaths, type LocalePaths } from "@/i18n/LocalePathsContext";
import type { Locale } from "@/i18n/config";
import { ProductDetailLayout } from "@/features/products/components/ProductDetailLayout";
import {
  publicProductInclude,
  serializePublicProduct,
} from "@/features/products/db/variantCompat";
import {
  getProductTitle,
  getProductShortDescription,
  getProductMetaTitle,
  getProductMetaDescription,
} from "@/features/products/utils/translations";
import { getBrandName } from "@/features/brands/utils/translations";
import { ProductReviewsSection } from "@/features/reviews/components/ProductReviewsSection";
import {
  RelatedProductsCarousel,
  type RelatedProduct,
} from "@/features/products/components/RelatedProductsCarousel";
import { Footer } from "@/components/layout/footer";

// Matches a v4 UUID (the canonical product.id format). Used to detect
// legacy URLs where the [slug] segment is actually a product UUID and
// redirect them to the locale-correct slug URL.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PublicProductPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

/**
 * Per-product SEO metadata. Crucially this advertises ALL locale variants
 * via hreflang `alternates.languages` so Google can serve the matching
 * language to each visitor and avoid duplicate-content penalties between
 * the four URL forms (`/en/products/...`, `/sr/proizvodi/...`, etc.).
 *
 * The canonical URL is the current locale's URL - keeping each language's
 * URL as its own canonical is the Google-recommended pattern for
 * multilingual sites where every locale serves substantively translated
 * content (which we do via ProductTranslation rows).
 */
export async function generateMetadata({
  params,
}: PublicProductPageProps): Promise<Metadata> {
  const { locale, slug } = await params;

  // Mirror the locale-agnostic resolution in `fetchPublicProductBySlug` so the
  // metadata (title, hreflang) is populated even when the URL carries another
  // locale's slug (a product with no translation in the active locale).
  const translationRow =
    (await prisma.productTranslation.findUnique({
      where: { locale_slug: { locale, slug } },
      select: { productId: true },
    })) ??
    (await prisma.productTranslation.findFirst({
      where: { slug },
      select: { productId: true },
    }));
  if (!translationRow) return {};

  const product = await prisma.product.findFirst({
    where: { id: translationRow.productId, status: "PUBLISHED", deletedAt: null },
    select: {
      translations: true,
      media: {
        take: 1,
        orderBy: { order: "asc" },
        where: { mediaType: "IMAGE" },
        select: { url: true },
      },
    },
  });
  if (!product) return {};

  const localTitle = getProductTitle(product, locale);
  const localMetaTitle = getProductMetaTitle(product, locale);
  const localMetaDescription =
    getProductMetaDescription(product, locale) ??
    getProductShortDescription(product, locale);

  const languages: Record<string, string> = {};
  for (const tr of product.translations) {
    // Absolute URLs are Google's recommendation for hreflang. Some
    // crawlers tolerate relative paths but the structured-data validator
    // gets noisy about them on multi-domain previews.
    languages[tr.locale] = absoluteUrl(
      getPathname({
        href: { pathname: "/products/[slug]", params: { slug: tr.slug } },
        locale: tr.locale as (typeof routing.locales)[number],
      }),
    );
  }
  // Canonical = current locale's URL when available, falling back to
  // the default-locale translation.
  const canonical = languages[locale] ?? languages[routing.defaultLocale];
  // x-default points crawlers at the default-locale URL when no language fits.
  languages["x-default"] = languages[routing.defaultLocale] ?? canonical;

  // First product image, served as the OG/Twitter share thumbnail. Drives
  // how the product looks when pasted into Facebook, Slack, iMessage,
  // WhatsApp, Twitter, etc. - by far the most visible SEO surface for
  // social distribution. Falling back to undefined keeps the metadata
  // valid when a product has no image yet.
  const ogImage = product.media[0]?.url;

  return {
    title: localMetaTitle ?? localTitle,
    description: localMetaDescription ?? undefined,
    alternates: {
      canonical,
      languages,
    },
    openGraph: {
      title: localMetaTitle ?? localTitle,
      description: localMetaDescription ?? undefined,
      locale,
      type: "website",
      images: ogImage ? [{ url: ogImage, alt: localTitle }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: localMetaTitle ?? localTitle,
      description: localMetaDescription ?? undefined,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function PublicProductPage({
  params,
}: PublicProductPageProps) {
  const { slug } = await params;
  const locale = await getLocale();

  // Legacy `/products/<uuid>` URLs (the pre-slug-routing format we shipped
  // earlier) get a 308 permanent redirect to the slug URL in the visitor's
  // active locale. Returning a 308 - not just notFound - preserves any
  // existing inbound links (email, chat, external sites) and keeps SEO
  // value flowing to the new canonical URL.
  if (UUID_RE.test(slug)) {
    const slugRow = await prisma.productTranslation.findFirst({
      where: { productId: slug, locale },
      select: { slug: true },
    });
    const fallback = slugRow
      ? slugRow
      : await prisma.productTranslation.findFirst({
          where: { productId: slug, locale: routing.defaultLocale },
          select: { slug: true },
        });
    if (fallback) {
      const target = getPathname({
        href: { pathname: "/products/[slug]", params: { slug: fallback.slug } },
        locale,
      });
      permanentRedirect(target);
    }
    notFound();
  }

  const product = await fetchPublicProductBySlug(locale, slug);
  if (!product) notFound();

  // Slug came from another locale (e.g. a listing card linked this product
  // using its default-locale slug because it has no translation in the active
  // locale). When this locale DOES have its own translation with a different
  // slug, 308 to that canonical slug - keeping the visitor in their language,
  // just correcting the URL. When it doesn't, we render in the active locale
  // with field-level fallback rather than switching the whole app's locale.
  const localTranslation = product.translations.find((tr) => tr.locale === locale);
  if (localTranslation && localTranslation.slug !== slug) {
    permanentRedirect(
      getPathname({
        href: { pathname: "/products/[slug]", params: { slug: localTranslation.slug } },
        locale,
      }),
    );
  }

  const relatedProducts = await fetchRelatedProducts(product.id);

  const localTitle = getProductTitle(product, locale);
  // PageHeader gets the short description (one-liner); the full description is
  // rendered inside ProductPurchaseSection on the right card.
  const localShortDescription = getProductShortDescription(product, locale);
  const localBrandName = product.brand ? getBrandName(product.brand, locale) : null;
  const t = await getTranslations("products");
  const tCrumbs = await getTranslations("breadcrumbs");

  // Page URL in the active locale - used as `Product.url`, the breadcrumb
  // terminal, and the canonical inside structured data.
  const productPath = getPathname({
    href: { pathname: "/products/[slug]", params: { slug } },
    locale,
  });
  const productsListPath = getPathname({ href: "/products", locale });

  // Per-locale URLs of THIS product, so the language switcher can hop
  // straight to e.g. `/sr/proizvodi/muski-vuneni-odelo` instead of
  // re-using the English slug and 404'ing. Locales the product has no
  // translation for are omitted; the switcher then falls back to next-intl's
  // pattern-only swap, which the locale-agnostic slug lookup still resolves.
  const localePaths: LocalePaths = {};
  for (const tr of product.translations) {
    localePaths[tr.locale as Locale] = getPathname({
      href: { pathname: "/products/[slug]", params: { slug: tr.slug } },
      locale: tr.locale as (typeof routing.locales)[number],
    });
  }

  // ----- JSON-LD payloads (rendered as inline <script> below) -----
  // Product schema powers Google Rich Results for product listings -
  // shows price, rating, availability directly in SERP. Falls back to
  // undefined fields on missing data so the structured-data validator
  // doesn't complain.
  const inStock = (product.stock ?? 0) > 0 ||
    product.variants.some((v) => v.stock > 0);
  const productSchema = productJsonLd({
    name: localTitle,
    description:
      localShortDescription ??
      getProductMetaDescription(product, locale) ??
      undefined,
    image: product.media.map((m) => m.url).slice(0, 8),
    url: absoluteUrl(productPath),
    brand: localBrandName,
    offers: {
      url: absoluteUrl(productPath),
      price: product.price,
      priceCurrency: "USD",
      availability: inStock ? "InStock" : "OutOfStock",
    },
    aggregateRating:
      product.ratingCount > 0
        ? {
            ratingValue: product.avgRating,
            reviewCount: product.ratingCount,
          }
        : null,
  });

  const homePath = getPathname({ href: "/", locale });
  const breadcrumbItems = [
    { name: tCrumbs("home"), href: homePath },
    { name: tCrumbs("products"), href: productsListPath },
    { name: localTitle, href: productPath },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PublishLocalePaths paths={localePaths} />
      <JsonLdScript data={productSchema} />
      <div className="shrink-0 px-6">
        <Breadcrumbs items={breadcrumbItems} />
        <PageHeader title={localTitle} description={localShortDescription ?? undefined}>
          <Button asChild variant="outline">
            <Link href="/products">{t("backToProducts")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <div className="flex-1 px-6 pb-6">
          <ProductDetailLayout product={product} />

          <div className="mt-12">
            <ProductReviewsSection
              productId={product.id}
              avgRating={product.avgRating}
              ratingCount={product.ratingCount}
            />
          </div>
        </div>

        <RelatedProductsCarousel products={relatedProducts} />

        <Footer />
      </div>
    </div>
  );
}

/**
 * Resolves a product by its locale-specific slug. The unique `(locale, slug)`
 * index on ProductTranslation lets us look up the product without scanning,
 * regardless of which locale the URL was generated in. Once the product is
 * found, we still return ALL its translations so the page can localize
 * fields independently of the lookup locale (e.g. brand badge shown in the
 * UI locale even if the URL slug came from a different one - though in
 * practice next-intl's `pathnames` keeps them in lockstep).
 */
async function fetchPublicProductBySlug(
  locale: string,
  slug: string,
): Promise<SerializedPublicProduct | null> {
  "use cache";
  cacheTag(CacheTags.products.publicAll());

  // Resolve by the active locale's slug first, then fall back to the slug in
  // ANY locale. The fallback covers products that have no translation in the
  // active locale: listing cards (and wishlist/related/quick-view) link those
  // using the default-locale slug while keeping the active locale's path
  // prefix (e.g. `/sr/proizvodi/<en-slug>`). Rather than 404 - or switch the
  // whole app's locale - we render the product in the visitor's locale and let
  // the `getProduct*` helpers fall back per field to the default-locale text.
  const translationRow =
    (await prisma.productTranslation.findUnique({
      where: { locale_slug: { locale, slug } },
      select: { productId: true },
    })) ??
    (await prisma.productTranslation.findFirst({
      where: { slug },
      select: { productId: true },
    }));
  if (!translationRow) return null;

  cacheTag(CacheTags.products.publicById(translationRow.productId));

  const product = await prisma.product.findFirst({
    where: { id: translationRow.productId, status: "PUBLISHED", deletedAt: null },
    include: publicProductInclude,
  });

  if (!product) return null;

  return serializePublicProduct(product);
}

async function fetchRelatedProducts(productId: string): Promise<RelatedProduct[]> {
  "use cache";
  cacheTag(CacheTags.products.publicAll());
  cacheTag(CacheTags.products.publicById(productId));

  // Resolve current product's signals for relatedness
  const current = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      brandId: true,
      organizationId: true,
      categories: { select: { categoryId: true } },
    },
  });

  if (!current) return [];

  const categoryIds = current.categories.map((c) => c.categoryId);

  const products = await prisma.product.findMany({
    where: {
      id: { not: productId },
      status: "PUBLISHED",
      deletedAt: null,
      OR: [
        ...(categoryIds.length > 0
          ? [{ categories: { some: { categoryId: { in: categoryIds } } } }]
          : []),
        ...(current.brandId ? [{ brandId: current.brandId }] : []),
        { organizationId: current.organizationId },
      ],
    },
    orderBy: [
      { featuredAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take: 12,
    select: {
      id: true,
      translations: { select: { locale: true, title: true, slug: true } },
      price: true,
      compareAtPrice: true,
      media: {
        orderBy: { order: "asc" },
        take: 1,
        select: { url: true, thumbUrl: true, mediaType: true },
      },
      brand: {
        select: {
          logoUrl: true,
          logoUrlDark: true,
          logoBackdrop: true,
          logoBackdropDark: true,
          translations: { select: { locale: true, name: true } },
        },
      },
    },
  });

  return products.map((p) => ({
    ...p,
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
  }));
}
