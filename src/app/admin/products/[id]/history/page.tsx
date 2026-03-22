import { getProductHistory } from "@/features/products/actions/products";
import {
  ProductRepo,
  productRepository,
} from "@/features/products/db/products";
import { PageHeader } from "@/components/PageHeader";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import {
  getProductGlobalTag,
  getProductIdTag,
} from "@/features/products/db/cache";
import { isActionErrorResult } from "@/features/common/errors/domainErrors";
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
  const result = await fetchProductsHistoryWithContext(id);

  if (!result) return notFound();

  if (isActionErrorResult(result)) {
    return (
      <div className="container my-6">
        <PageHeader
          title="Product History"
          description={`Version history for product ${id}.`}
        />
        <Alert variant="destructive">
          <AlertTitle>Error loading product history</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const history: ProductHistory[] = result as ProductHistory[];

  if (history.length === 0) {
    return (
      <div className="container my-6">
        <PageHeader
          title="Product History"
          description={`Version history for product ${id}.`}
        />
        <Alert>
          <AlertTitle>No product history found</AlertTitle>
          <AlertDescription>
            There is currently no version history for this product.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container my-6">
      <PageHeader
        title="Product History"
        description={`Version history for product ${id}.`}
      />
      <div className="mt-4">
        <ProductHistoryTable history={history} />
      </div>
    </div>
  );
}

async function fetchProductsHistoryWithContext(id: string) {
  "use cache";
  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  cacheTag(getProductGlobalTag(ctx.organizationId));
  cacheTag(getProductIdTag(ctx.organizationId, id));

  const repo: ProductRepo = productRepository(ctx);
  return getProductHistory(repo, id);
}
