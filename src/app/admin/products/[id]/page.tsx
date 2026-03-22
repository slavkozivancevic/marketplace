"use server";

import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";

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
import { ProductDetails } from "@/features/products/components/ProductDetails";
import { ActionErrorResult, ProductWithRelations } from "@/types/types";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const result = await fetchProductWithContext(id);

  if (isActionErrorResult(result)) {
    return (
      <div className="container my-6">
        <PageHeader
          title="Product Details"
          description="View detailed information about this product."
        />
        <Alert variant="destructive">
          <AlertTitle>Error loading product</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const product: ProductWithRelations | null =
    result as ProductWithRelations | null;

  if (!product) {
    notFound();
  }
  // if (!product) {
  //   return (
  //     <div className="container my-6">
  //       <PageHeader title="Product Details" />
  //       <Alert>
  //         <AlertTitle>Product not found</AlertTitle>
  //         <AlertDescription>There is no product with ID {id}.</AlertDescription>
  //       </Alert>
  //     </div>
  //   );
  // }

  return (
    <div className="container my-6">
      <PageHeader
        title={`Product: ${product.title}`}
        description="View detailed information about this product."
      />
      <ProductDetails product={product} />
    </div>
  );
}

async function fetchProductWithContext(
  id: string,
): Promise<ProductWithRelations | null | ActionErrorResult> {
  "use cache";

  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  cacheTag(getProductGlobalTag(ctx.organizationId));
  cacheTag(getProductIdTag(ctx.organizationId, id));

  const repo: ProductRepo = productRepository(ctx);
  return getProductById(repo, id);
}
