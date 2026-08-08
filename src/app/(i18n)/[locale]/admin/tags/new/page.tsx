import { Link, getPathname } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { TagForm } from "@/features/tags/components/TagForm";

export default async function NewTagPage() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminTags"), href: getPathname({ href: "/admin/tags", locale }) },
    { name: tCrumbs("newTag"), href: getPathname({ href: "/admin/tags/new", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("admin.createTag")}
          description={t("admin.createTagDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/admin/tags">{t("admin.backToTags")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <TagForm mode="create" />
      </div>
    </div>
  );
}
