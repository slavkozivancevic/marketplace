import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";

import { productRepository } from "@/features/products/db/products";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { CacheTags } from "@/lib/cache/tags";
import { isActionErrorResult } from "@/features/common/errors/domainErrors";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ProductDetails } from "@/features/products/components/ProductDetails";
import { SerializedProductWithRelations } from "@/types/types";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProductPage({ params }: ProductPageProps) {
  const { id } = await params;

  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  const result = await fetchProduct(ctx.organizationId, ctx.userId, id);

  if (isActionErrorResult(result)) {
    return (
      <div className="container">
        <PageHeader
          title="Product Details"
          description="View detailed information about this product."
        >
          <Button asChild variant="outline">
            <Link href="/admin/products">Back to Products</Link>
          </Button>
        </PageHeader>
        <Alert variant="destructive">
          <AlertTitle>Error loading product</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const product = result as SerializedProductWithRelations | null;

  if (!product) notFound();

  return (
    <div className="container">
      <PageHeader
        title={product.title}
        description="View detailed information about this product."
      >
        <Button asChild variant="outline">
          <Link href="/admin/products">Back to Products</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/admin/products/${id}/history`}>History</Link>
        </Button>
        <Button asChild>
          <Link href={`/admin/products/${id}/edit`}>Edit</Link>
        </Button>
      </PageHeader>
      <ProductDetails product={product} />
    </div>
  );
}

async function fetchProduct(
  organizationId: string,
  userId: string,
  id: string,
): Promise<
  SerializedProductWithRelations | null | { error: boolean; message: string }
> {
  "use cache";
  cacheTag(CacheTags.products.all(organizationId));
  cacheTag(CacheTags.products.byId(organizationId, id));
  try {
    const repo = productRepository({ organizationId, userId });
    const result = await repo.getById(id);

    if (!result) return null;

    return {
      ...result,
      price: Number(result.price),
      variants: result.variants.map((v) => ({
        ...v,
        price: Number(v.price),
      })),
    };
  } catch {
    return { error: true, message: "Failed to load product" };
  }
}
