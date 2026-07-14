import { Link, getPathname } from "@/i18n/navigation";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { CacheTags } from "@/lib/cache/tags";
import { getAllAttributes } from "@/features/attributes/db/attributes";
import { AdminAttributesPage } from "@/features/attributes/components/AdminAttributesPage";

export default async function AdminAttributesRoute() {
  await connection();
  const t = await getTranslations("adminAttributes");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const attributes = await fetchAttributes();

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    {
      name: tCrumbs("adminAttributes"),
      href: getPathname({ href: "/admin/attributes", locale }),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("title")} description={t("pageDesc")}>
          <Button asChild>
            <Link href="/admin/attributes/new">{t("addAttribute")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <AdminAttributesPage attributes={attributes} />
      </div>
    </div>
  );
}

async function fetchAttributes() {
  "use cache";
  cacheTag(CacheTags.attributes.all());
  return getAllAttributes();
}
