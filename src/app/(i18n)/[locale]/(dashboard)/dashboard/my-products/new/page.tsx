import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { ProductFormView } from "@/features/products/components/ProductFormView";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { VerificationRequiredNotice } from "@/components/VerificationRequiredNotice";
import { Link, getPathname } from "@/i18n/navigation";
import { CacheTags } from "@/lib/cache/tags";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { getCategoryTree } from "@/features/categories/db/categories";
import { getAllBrands } from "@/features/brands/db/brands";
import {
  fetchAttributeSelector,
  fetchCategoryAttributeMap,
} from "@/features/attributes/db/formData";

export default async function NewMyProductPage() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const ctx = await resolveRequestContext();

  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("myProducts"), href: getPathname({ href: "/dashboard/my-products", locale }) },
    { name: tCrumbs("newProduct"), href: getPathname({ href: "/dashboard/my-products/new", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
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
        {ctx.organizationVerified ? (
          <CreateProductForm />
        ) : (
          <VerificationRequiredNotice
            title={t("myProducts.verifyRequiredTitle")}
            description={t("myProducts.verifyRequiredDesc")}
          >
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/organization">{t("myProducts.viewOrgStatus")}</Link>
            </Button>
          </VerificationRequiredNotice>
        )}
      </div>
    </div>
  );
}

// Only fetch the (heavy) form option data once the org is verified and the form
// will actually render.
async function CreateProductForm() {
  const [brands, categoryTree, attributeLibrary, categoryAttributeMap] =
    await Promise.all([
      fetchBrands(),
      fetchCategoryTree(),
      fetchAttributeSelector(),
      fetchCategoryAttributeMap(),
    ]);

  return (
    <ProductFormView
      mode="create"
      redirectTo="/dashboard/my-products"
      brands={brands}
      categoryTree={categoryTree}
      attributeLibrary={attributeLibrary}
      categoryAttributeMap={categoryAttributeMap}
    />
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
