import { cacheTag } from "next/cache";
import Link from "next/link";

import { productRepository } from "@/features/products/db/products";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { CacheTags } from "@/lib/cache/tags";
import { isActionErrorResult } from "@/features/common/errors/domainErrors";
import { PageHeader } from "@/components/PageHeader";
import { ProductTable } from "@/features/products/components/ProductTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ProductListItem } from "@/types/types";

export default async function AdminProductsPage() {
  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  const result = await fetchProducts(ctx.organizationId, ctx.userId);

  if (isActionErrorResult(result)) {
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

      {products.length === 0 ? (
        <Alert>
          <AlertTitle>No products found</AlertTitle>
          <AlertDescription>
            There are currently no products to display.
          </AlertDescription>
        </Alert>
      ) : (
        <ProductTable products={products} nextCursor={nextCursor} showActions />
      )}
    </div>
  );
}

async function fetchProducts(organizationId: string, userId: string) {
  "use cache";
  cacheTag(CacheTags.products.all(organizationId));
  try {
    const repo = productRepository({ organizationId, userId });
    const result = await repo.getAll();

    if ("products" in result && Array.isArray(result.products)) {
      return {
        ...result,
        products: result.products.map((product) => ({
          ...product,
          price: Number(product.price),
        })),
      };
    }

    return result;
  } catch {
    return { error: true, message: "Failed to load products" };
  }
}
