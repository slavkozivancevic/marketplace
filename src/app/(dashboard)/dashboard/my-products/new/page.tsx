import { cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { ProductForm } from "@/features/products/components/ProductForm";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CacheTags } from "@/lib/cache/tags";
import { getCategoryTree } from "@/features/categories/db/categories";
import { getAllBrands } from "@/features/brands/db/brands";

export default async function NewMyProductPage() {
  const t = await getTranslations();
  const [brands, categoryTree] = await Promise.all([fetchBrands(), fetchCategoryTree()]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={t("myProducts.createNew")}
          description={t("myProducts.createNewDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/dashboard/my-products">{t("myProducts.backTo")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6">
        <ProductForm mode="create" redirectTo="/dashboard/my-products" brands={brands} categoryTree={categoryTree} />
      </div>
    </div>
  );
}

async function fetchBrands() {
  "use cache";
  cacheTag(CacheTags.brands.all());
  return getAllBrands();
}

async function fetchCategoryTree() {
  "use cache";
  cacheTag(CacheTags.categories.all());
  return getCategoryTree();
}
