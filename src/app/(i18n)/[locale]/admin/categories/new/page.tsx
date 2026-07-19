import { Link, getPathname } from "@/i18n/navigation";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import {
  getAllCategoriesFlat,
  getCategoryAttributeMap,
} from "@/features/categories/db/categories";
import { getAttributeLibrary } from "@/features/attributes/db/attributes";
import { CategoryForm } from "@/features/categories/components/CategoryForm";

export default async function NewCategoryPage() {
  const t = await getTranslations("adminCategories");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const [allCategories, attributeLibrary, categoryAttributeMap] =
    await Promise.all([
      fetchCategories(),
      fetchAttributeLibrary(),
      fetchCategoryAttributeMap(),
    ]);

  const parentOptions = allCategories.map((c) => ({
    id: c.id,
    parentId: c.parentId,
    translations: c.translations,
  }));

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminCategories"), href: getPathname({ href: "/admin/categories", locale }) },
    { name: tCrumbs("newCategory"), href: getPathname({ href: "/admin/categories/new", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("createTitle")} description={t("createDesc")}>
          <Button asChild variant="outline">
            <Link href="/admin/categories">{t("back")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <CategoryForm
          mode="create"
          parentOptions={parentOptions}
          attributeLibrary={attributeLibrary}
          categoryAttributeMap={categoryAttributeMap}
        />
      </div>
    </div>
  );
}

async function fetchCategories() {
  "use cache";
  cacheTag(CacheTags.categories.all());
  return getAllCategoriesFlat();
}

async function fetchAttributeLibrary() {
  "use cache";
  cacheTag(CacheTags.attributes.all());
  return getAttributeLibrary();
}

async function fetchCategoryAttributeMap() {
  "use cache";
  cacheTag(CacheTags.categories.all());
  return getCategoryAttributeMap();
}