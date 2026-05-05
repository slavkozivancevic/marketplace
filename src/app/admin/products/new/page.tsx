import { cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { ProductForm } from "@/features/products/components/ProductForm";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CacheTags } from "@/lib/cache/tags";
import { getAllBrands } from "@/features/brands/db/brands";

export default async function NewProductPage() {
  const t = await getTranslations();
  const brands = await fetchBrands();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={t("admin.createProduct")}
          description={t("admin.createProductDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/admin/products">{t("admin.backToProducts")}</Link>
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
