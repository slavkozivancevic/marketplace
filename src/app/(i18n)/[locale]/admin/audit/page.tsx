import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { getPathname } from "@/i18n/navigation";
import { getAuditFacets } from "@/features/audit/db/queries";
import { AuditLogView } from "@/features/audit/components/AuditLogView";

export default async function AdminAuditRoute() {
  await connection();
  const t = await getTranslations("admin.audit");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const facets = await getAuditFacets();

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("audit"), href: getPathname({ href: "/admin/audit", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("title")} description={t("description")} />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <AuditLogView facets={facets} />
      </div>
    </div>
  );
}
