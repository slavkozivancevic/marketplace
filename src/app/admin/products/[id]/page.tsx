import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";

import { getProductById } from "@/features/products/actions/products";
import { productRepository } from "@/features/products/db/products";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import {
  getProductGlobalTag,
  getProductIdTag,
} from "@/features/products/db/cache";
import { ProductRepo } from "@/features/products/db/products";
import { isActionErrorResult } from "@/features/common/errors/domainErrors";

import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ProductDetails } from "@/features/products/components/ProductDetails";
import { ProductWithRelations } from "@/types/types";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
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

  const product = result as ProductWithRelations | null;

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
) {
  "use cache";

  cacheTag(getProductGlobalTag(organizationId));
  cacheTag(getProductIdTag(organizationId, id));

  const repo: ProductRepo = productRepository({ organizationId, userId });
  return getProductById(repo, id);
}
