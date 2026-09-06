import { Link, getPathname } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { AttributeTableSkeleton } from "@/features/attributes/components/AttributeTableSkeleton";

/**
 * See the note in ../../brands/(list)/loading.tsx - real shell, skeleton body
 * only. This route needs it more than most: the page calls `await connection()`
 * before anything renders, so it is fully dynamic and the whole attribute list
 * is fetched before the first byte.
 */
export default async function AdminAttributesLoading() {
  const t = await getTranslations("adminAttributes");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    {
      name: tCrumbs("adminAttributes"),
      href: getPathname({ href: "/admin/attributes", locale }),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("title")} description={t("pageDesc")}>
          <Button asChild>
            <Link href="/admin/attributes/new">{t("addAttribute")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <AttributeTableSkeleton />
      </div>
    </div>
  );
}
