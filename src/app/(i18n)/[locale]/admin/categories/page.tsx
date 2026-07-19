import { Link, getPathname } from "@/i18n/navigation";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getAllCategoriesFlat } from "@/features/categories/db/categories";
import { AdminCategoriesPage } from "@/features/categories/components/AdminCategoriesPage";

export default async function AdminCategoriesRoute() {
  await connection();
  const t = await getTranslations("adminCategories");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const categories = await fetchCategories();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminCategories"), href: getPathname({ href: "/admin/categories", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("title")} description={t("pageDesc")}>
          <Button asChild>
            <Link href="/admin/categories/new">{t("addCategory")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <AdminCategoriesPage categories={categories} />
      </div>
    </div>
  );
}

async function fetchCategories() {
  "use cache";
  cacheTag(CacheTags.categories.all());
  return getAllCategoriesFlat();
}
