import { cacheTag } from "next/cache";
import Link from "next/link";

import { getProducts } from "@/features/products/actions/products";
import { productRepository } from "@/features/products/db/products";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { getProductGlobalTag } from "@/features/products/db/cache";
import { ProductRepo } from "@/features/products/db/products";

import { PageHeader } from "@/components/PageHeader";
import { ProductTable } from "@/features/products/components/ProductTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isActionErrorResult } from "@/features/common/errors/domainErrors";
import { ProductListItem } from "@/types/types";

export default async function ProductsPage() {
  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  const result = await fetchProducts(ctx.organizationId, ctx.userId);

  if (isActionErrorResult(result)) {
    return (
      <div className="container">
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

  const { products, nextCursor } = result as {
    products: ProductListItem[];
    nextCursor?: string;
  };

  if (products.length === 0) {
    return (
      <div className="container">
        <PageHeader
          title="Products"
          description="Browse and manage your product catalog."
        >
          <Button asChild>
            <Link href="/admin/products/new">Add Product</Link>
          </Button>
        </PageHeader>
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
    <div className="container">
      <PageHeader
        title="Products"
        description="Browse and manage your product catalog."
      >
        <Button asChild>
          <Link href="/admin/products/new">Add Product</Link>
        </Button>
      </PageHeader>
      <ProductTable products={products} nextCursor={nextCursor} showActions />
    </div>
  );
}

async function fetchProducts(organizationId: string, userId: string) {
  "use cache";

  cacheTag(getProductGlobalTag(organizationId));

  const repo: ProductRepo = productRepository({ organizationId, userId });
  return getProducts(repo);
}