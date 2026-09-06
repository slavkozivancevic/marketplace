import { Link, getPathname } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { CategoryTableSkeleton } from "@/features/categories/components/CategoryTableSkeleton";

/**
 * See the note in ../../brands/(list)/loading.tsx - real shell, skeleton body
 * only. Like the attributes list, this page calls `await connection()` before
 * anything renders, so the whole tree is fetched before the first byte.
 */
export default async function AdminCategoriesLoading() {
  const t = await getTranslations("adminCategories");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    {
      name: tCrumbs("adminCategories"),
      href: getPathname({ href: "/admin/categories", locale }),
    },
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
        <CategoryTableSkeleton />
      </div>
    </div>
  );
}
