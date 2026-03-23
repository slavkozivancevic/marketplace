import { ProductForm } from "@/features/products/components/ProductForm";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NewProductPage() {
  return (
    <div className="container">
      <PageHeader
        title="Create New Product"
        description="Fill out the form to add a new product."
      >
        <Button asChild variant="outline">
          <Link href="/admin/products">Back to Products</Link>
        </Button>
      </PageHeader>

      <ProductForm mode="create" />
    </div>
  );
}
