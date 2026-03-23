import { ProductForm } from "@/features/products/components/ProductForm";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getProductById } from "@/features/products/actions/products";
import { notFound } from "next/navigation";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { productRepository } from "@/features/products/db/products";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

async function EditProductForm({ productId }: { productId: string }) {
  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  const repo = productRepository({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
  });
  const product = await getProductById(repo, productId);

  if (!product || "error" in product) notFound();

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
