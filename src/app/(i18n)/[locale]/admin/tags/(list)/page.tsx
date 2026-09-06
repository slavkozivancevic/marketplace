import { Link, getPathname } from "@/i18n/navigation";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getAllTags } from "@/features/tags/db/tags";
import { AdminTagsPage } from "@/features/tags/components/AdminTagsPage";

export default async function AdminTagsRoute() {
  await connection();
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const tags = await fetchTags();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminTags"), href: getPathname({ href: "/admin/tags", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("admin.tags")}
          description={t("admin.tagsManage")}
        >
          <Button asChild>
            <Link href="/admin/tags/new">{t("admin.addTag")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <AdminTagsPage tags={tags} />
      </div>
    </div>
  );
}

async function fetchTags() {
  "use cache";
  cacheTag(CacheTags.tags.all());
  return getAllTags();
}
