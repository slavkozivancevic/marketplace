import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/core/db/prisma";
import { CacheTags } from "@/lib/cache/tags";
import { SerializedPublicProduct } from "@/types/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ProductImageCarousel } from "@/components/product/ProductImageCarousel";
import { ProductPurchaseSection } from "@/features/products/components/ProductPurchaseSection";

interface PublicProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function PublicProductPage({
  params,
}: PublicProductPageProps) {
  const { id } = await params;

  const product = await fetchPublicProduct(id);

  if (!product) notFound();

  return (
    <div className="container">
      <PageHeader title={product.title} description={product.description}>
        <Button asChild variant="outline">
          <Link href="/products">Back to Products</Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <ProductImageCarousel images={product.images} title={product.title} />
        </div>

        <ProductPurchaseSection product={product} />
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
      images: { orderBy: { order: "asc" } },
      variants: {
        orderBy: { order: "asc" },
        include: { optionValues: { orderBy: { order: "asc" } } },
      },
      options: {
        orderBy: { order: "asc" },
        include: { values: { orderBy: { order: "asc" } } },
      },
    },
  });

  if (!product) return null;

  return {
    ...product,
    price: Number(product.price),
    variants: product.variants.map((v) => ({
      ...v,
      price: Number(v.price),
    })),
  };
}
