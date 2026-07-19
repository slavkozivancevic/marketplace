import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";

import { getAllOrganizations } from "@/features/organizations/db/organizations";
import { CacheTags } from "@/lib/cache/tags";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { getPathname } from "@/i18n/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AdminOrganizationsPage } from "@/features/organizations/components/AdminOrganizationsPage";

export default async function AdminOrganizationsRoute() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const organizations = await fetchOrganizations();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminOrganizations"), href: getPathname({ href: "/admin/organizations", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("admin.manageOrgs")}
          description={t("admin.manageOrgsDesc")}
        />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6">
        {organizations.length === 0 ? (
          <Alert>
            <AlertTitle>{t("admin.noOrgs")}</AlertTitle>
            <AlertDescription>
              {t("admin.noOrgsDesc")}
            </AlertDescription>
          </Alert>
        ) : (
          <AdminOrganizationsPage
            organizations={JSON.parse(JSON.stringify(organizations))}
          />
        )}
      </div>
    </div>
  );
}

async function fetchOrganizations() {
  "use cache";
  cacheTag(CacheTags.organizations.all());
  return getAllOrganizations();
}