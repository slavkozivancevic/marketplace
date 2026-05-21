import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import Link from "next/link";

import { prisma } from "@/core/db/prisma";
import { CacheTags } from "@/lib/cache/tags";
import { SerializedPublicProduct } from "@/types/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ProductDetailLayout } from "@/features/products/components/ProductDetailLayout";
import {
  getProductTitle,
  getProductShortDescription,
  type ProductTranslations,
} from "@/features/products/utils/translations";
import { ProductReviewsSection } from "@/features/reviews/components/ProductReviewsSection";
import {
  RelatedProductsCarousel,
  type RelatedProduct,
} from "@/features/products/components/RelatedProductsCarousel";
import { Footer } from "@/components/layout/footer";

interface PublicProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicProductPage({
  params,
}: PublicProductPageProps) {
  const { id } = await params;

  const [product, relatedProducts, locale] = await Promise.all([
    fetchPublicProduct(id),
    fetchRelatedProducts(id),
    getLocale(),
  ]);

  if (!product) notFound();

  const productTranslations = product.translations as ProductTranslations | null;
  const localTitle = getProductTitle({ title: product.title, translations: productTranslations }, locale);
  // PageHeader gets the short description (one-liner); the full description is
  // rendered inside ProductPurchaseSection on the right card.
  const localShortDescription = getProductShortDescription(
    { shortDescription: product.shortDescription, translations: productTranslations },
    locale,
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader title={localTitle} description={localShortDescription ?? undefined}>
          <Button asChild variant="outline">
            <Link href="/products">Back to Products</Link>
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

async function fetchPublicProduct(
  id: string,
): Promise<SerializedPublicProduct | null> {
  "use cache";
  cacheTag(CacheTags.products.publicAll());
  cacheTag(CacheTags.products.publicById(id));

  const product = await prisma.product.findFirst({
    where: { id, status: "PUBLISHED", deletedAt: null },
    include: {
      media: { orderBy: { order: "asc" } },
      variants: {
        orderBy: { order: "asc" },
        include: {
          optionValues: {
            orderBy: [{ option: { order: "asc" } }, { order: "asc" }],
          },
          media: {
            orderBy: { order: "asc" },
            include: { media: true },
          },
        },
      },
      options: {
        orderBy: { order: "asc" },
        include: { values: { orderBy: { order: "asc" } } },
      },
      brand: { select: { id: true, name: true, logoUrl: true } },
    },
  });

  if (!product) return null;

  return {
    ...product,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice != null ? Number(product.compareAtPrice) : null,
    costPrice: product.costPrice != null ? Number(product.costPrice) : null,
    variants: product.variants.map((v) => ({
      ...v,
      price: Number(v.price),
      compareAtPrice: v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
      costPrice: v.costPrice != null ? Number(v.costPrice) : null,
    })),
  };
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
      title: true,
      translations: true,
      price: true,
      compareAtPrice: true,
      media: {
        orderBy: { order: "asc" },
        take: 1,
        select: { url: true, thumbUrl: true, mediaType: true },
      },
      brand: { select: { name: true, logoUrl: true } },
    },
  });

  return products.map((p) => ({
    ...p,
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
  }));
}
