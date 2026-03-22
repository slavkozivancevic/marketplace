import { ProductForm } from "@/features/products/components/ProductForm";
import { PageHeader } from "@/components/PageHeader";
import { getProductById } from "@/features/products/actions/products";
import { notFound } from "next/navigation";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { productRepository } from "@/features/products/db/products";

interface EditProductPageProps {
  params: {
    id: string;
  };
}

async function EditProductForm({ productId }: { productId: string }) {
  const ctx = await resolveRequestContext();
  const repo = productRepository(ctx);
  const product = await getProductById(repo, productId);

  if (!product || "error" in product) {
    notFound();
  }

  return <ProductForm mode="update" product={product} />;
}

export default function EditProductPage({ params }: EditProductPageProps) {
  return (
    <div className="container">
      <PageHeader
        title="Edit Product"
        description="Update the product details."
      />

      <EditProductForm productId={params.id} />
    </div>
  );
}