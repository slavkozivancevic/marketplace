import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";

import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { productRepository } from "@/features/products/db/products";
import {
  handleActionError,
  isActionErrorResult,
} from "@/features/common/errors/domainErrors";
import { CacheTags } from "@/lib/cache/tags";
import { ProductForm } from "@/features/products/components/ProductForm";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SerializedProductWithRelations } from "@/types/types";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

async function EditProductForm({ productId }: { productId: string }) {
  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  const result = await fetchProductForEdit(
    ctx.organizationId,
    ctx.userId,
    productId,
  );

  if (isActionErrorResult(result)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading product</AlertTitle>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
    );
  }

  const product = result as SerializedProductWithRelations | null;

  if (!product) notFound();

  return <ProductForm mode="update" product={product} />;
}

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const { id } = await params;

  return (
    <div className="container">
      <PageHeader
        title="Edit Product"
        description="Update the product details."
      >
        <Button asChild variant="outline">
          <Link href={`/admin/products/${id}`}>Back to Product</Link>
        </Button>
      </PageHeader>

      <EditProductForm productId={id} />
    </div>
  );
}

async function fetchProductForEdit(
  organizationId: string,
  userId: string,
  id: string,
): Promise<
  SerializedProductWithRelations | null | { error: boolean; message: string }
> {
  "use cache";
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
  } catch (error) {
    return handleActionError(error);
  }
}
