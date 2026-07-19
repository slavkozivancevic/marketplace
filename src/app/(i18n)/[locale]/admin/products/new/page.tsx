import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { ProductFormView } from "@/features/products/components/ProductFormView";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Link, getPathname } from "@/i18n/navigation";
import { CacheTags } from "@/lib/cache/tags";
import { getAllBrands } from "@/features/brands/db/brands";
import { getCategoryTree } from "@/features/categories/db/categories";
import {
  fetchAttributeSelector,
  fetchCategoryAttributeMap,
} from "@/features/attributes/db/formData";

export default async function NewProductPage() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const [brands, categoryTree, attributeLibrary, categoryAttributeMap] =
    await Promise.all([
      fetchBrands(),
      fetchCategoryTree(),
      fetchAttributeSelector(),
      fetchCategoryAttributeMap(),
    ]);

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminProducts"), href: getPathname({ href: "/admin/products", locale }) },
    { name: tCrumbs("newProduct"), href: getPathname({ href: "/admin/products/new", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
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
        <ProductFormView
          mode="create"
          brands={brands}
          categoryTree={categoryTree}
          attributeLibrary={attributeLibrary}
          categoryAttributeMap={categoryAttributeMap}
        />
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
