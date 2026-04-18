import { cacheTag } from "next/cache";
import { ProductForm } from "@/features/products/components/ProductForm";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CacheTags } from "@/lib/cache/tags";
import { getAllBrands } from "@/features/brands/db/brands";

export default async function NewProductPage() {
  const brands = await fetchBrands();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title="Create New Product"
          description="Fill out the form to add a new product."
        >
          <Button asChild variant="outline">
            <Link href="/admin/products">Back to Products</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6">
        <ProductForm mode="create" brands={brands} />
      </div>
    </div>
  );
}

async function fetchBrands() {
  "use cache";
  cacheTag(CacheTags.brands.all());
  return getAllBrands();
}
