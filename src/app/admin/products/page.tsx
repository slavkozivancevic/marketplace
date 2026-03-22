"use server";

import { cacheTag } from "next/cache";

import { getProducts } from "@/features/products/actions/products";
import { productRepository } from "@/features/products/db/products";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { getProductGlobalTag } from "@/features/products/db/cache";
import { ProductRepo } from "@/features/products/db/products";

import { PageHeader } from "@/components/PageHeader";
import { ProductTable } from "@/features/products/components/ProductTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isActionErrorResult } from "@/features/common/errors/domainErrors";
import { Product } from "@/generated/prisma/client";

export default async function ProductsPage() {
  const result = await fetchProductsWithContext();

  if (isActionErrorResult(result)) {
    return (
      <div className="container my-6">
        <PageHeader
          title="Products"
          description="Browse and manage your product catalog."
        />
        <Alert variant="destructive">
          <AlertTitle>Error loading products</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const products: Product[] = (
    result as { products: Product[]; nextCursor?: string }
  ).products;
  const nextCursor: string | undefined = (
    result as { products: Product[]; nextCursor?: string }
  ).nextCursor;

  if (products.length === 0) {
    return (
      <div className="container my-6">
        <PageHeader
          title="Products"
          description="Browse and manage your product catalog."
        />
        <Alert>
          <AlertTitle>No products found</AlertTitle>
          <AlertDescription>
            There are currently no products to display.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container my-6">
      <PageHeader
        title="Products"
        description="Browse and manage your product catalog."
      />
      <ProductTable products={products} nextCursor={nextCursor} showActions />
    </div>
  );
}

async function fetchProductsWithContext() {
  "use cache";
  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  cacheTag(getProductGlobalTag(ctx.organizationId));

  const repo: ProductRepo = productRepository(ctx);
  return getProducts(repo);
}
