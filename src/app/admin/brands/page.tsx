import Link from "next/link";
import { cacheTag } from "next/cache";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getAllBrands } from "@/features/brands/db/brands";
import { AdminBrandsPage } from "@/features/brands/components/AdminBrandsPage";

export default async function AdminBrandsRoute() {
  const brands = await fetchBrands();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title="Brands"
          description="Manage product brands."
        >
          <Button asChild>
            <Link href="/admin/brands/new">Add Brand</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <AdminBrandsPage brands={brands} />
      </div>
    </div>
  );
}

async function fetchBrands() {
  "use cache";
  cacheTag(CacheTags.brands.all());
  return getAllBrands();
}