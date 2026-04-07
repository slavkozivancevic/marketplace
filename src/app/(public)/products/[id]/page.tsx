import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";

import { prisma } from "@/core/db/prisma";
import { CacheTags } from "@/lib/cache/tags";
import { SerializedPublicProduct } from "@/types/types";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductImageCarousel } from "@/components/product/ProductImageCarousel";
import { AddToCart } from "@/features/cart/components/AddToCart";

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

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <p className="text-3xl font-bold">${product.price.toFixed(2)}</p>
              <p className="text-muted-foreground">{product.description}</p>
              <AddToCart product={product} />
            </CardContent>
          </Card>

          {product.options.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Options</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {product.options.map((option) => (
                  <div key={option.id}>
                    <p className="text-sm font-medium mb-1">{option.name}</p>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(
                        new Set(option.values.map((v) => v.value)),
                      ).map((value) => (
                        <Badge key={value} variant="outline">
                          {value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {product.variants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Variants</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {product.variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex items-center justify-between border rounded p-2 text-sm"
                  >
                    <div className="flex flex-wrap gap-1">
                      {variant.optionValues.map((ov) => (
                        <Badge key={ov.id} variant="secondary">
                          {ov.value}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>${variant.price.toFixed(2)}</span>
                      <span>
                        {variant.stock > 0
                          ? `${variant.stock} in stock`
                          : "Out of stock"}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {product.variants.length === 0 && (
            <Alert>
              <AlertTitle>No variants available</AlertTitle>
              <AlertDescription>
                This product has no variants configured.
              </AlertDescription>
            </Alert>
          )}
        </div>
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
      variants: { include: { optionValues: true } },
      options: { include: { values: true } },
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
