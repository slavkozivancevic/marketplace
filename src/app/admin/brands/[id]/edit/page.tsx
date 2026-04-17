import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheTag } from "next/cache";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getBrandById } from "@/features/brands/db/brands";
import { BrandForm } from "@/features/brands/components/BrandForm";

export default async function EditBrandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brand = await fetchBrand(id);

  if (!brand) notFound();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={`Edit: ${brand.name}`}
          description="Update brand details."
        >
          <Button asChild variant="outline">
            <Link href="/admin/brands">Back to Brands</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <BrandForm
          mode="edit"
          brandId={brand.id}
          defaultValues={{
            name: brand.name,
            slug: brand.slug,
            logoUrl: brand.logoUrl ?? "",
            description: brand.description ?? "",
          }}
        />
      </div>
    </div>
  );
}

async function fetchBrand(id: string) {
  "use cache";
  cacheTag(CacheTags.brands.byId(id));
  return getBrandById(id);
}