import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";

import { getProductHistory } from "@/features/products/actions/products";
import {
  ProductRepo,
  productRepository,
} from "@/features/products/db/products";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import {
  getProductGlobalTag,
  getProductIdTag,
} from "@/features/products/db/cache";
import { isActionErrorResult } from "@/features/common/errors/domainErrors";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductHistory } from "@/generated/prisma/client";
import { ProductHistoryTable } from "@/features/products/components/ProductHistoryTable";

interface ProductHistoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductHistoryPage({
  params,
}: ProductHistoryPageProps) {
  const { id } = await params;

  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  const result = await fetchProductHistory(ctx.organizationId, ctx.userId, id);

  if (!result) return notFound();

  if (isActionErrorResult(result)) {
    return (
      <div className="container">
        <PageHeader
          title="Product History"
          description={`Version history for product ${id}.`}
        >
          <Button asChild variant="outline">
            <Link href={`/admin/products/${id}`}>Back to Product</Link>
          </Button>
        </PageHeader>
        <Alert variant="destructive">
          <AlertTitle>Error loading product history</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const history = result as ProductHistory[];

  if (history.length === 0) {
    return (
      <div className="container">
        <PageHeader
          title="Product History"
          description={`Version history for product ${id}.`}
        >
          <Button asChild variant="outline">
            <Link href={`/admin/products/${id}`}>Back to Product</Link>
          </Button>
        </PageHeader>
        <Alert>
          <AlertTitle>No history found</AlertTitle>
          <AlertDescription>
            There is currently no version history for this product.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container">
      <PageHeader
        title="Product History"
        description={`Version history for product ${id}.`}
      >
        <Button asChild variant="outline">
          <Link href={`/admin/products/${id}`}>Back to Product</Link>
        </Button>
      </PageHeader>
      <div className="mt-4">
        <ProductHistoryTable history={history} />
      </div>
    </div>
  );
}

async function fetchProductHistory(
  organizationId: string,
  userId: string,
  id: string,
) {
  "use cache";

  cacheTag(getProductGlobalTag(organizationId));
  cacheTag(getProductIdTag(organizationId, id));

  const repo: ProductRepo = productRepository({ organizationId, userId });
  return getProductHistory(repo, id);
}
