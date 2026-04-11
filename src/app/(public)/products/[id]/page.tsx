import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/core/db/prisma";
import { CacheTags } from "@/lib/cache/tags";
import { SerializedPublicProduct } from "@/types/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { ProductDetailLayout } from "@/features/products/components/ProductDetailLayout";

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

      <ProductDetailLayout product={product} />
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
        include: {
          optionValues: {
            orderBy: [
              { option: { order: "asc" } },
              { order: "asc" },
            ],
          },
          images: { orderBy: { order: "asc" } },
        },
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
