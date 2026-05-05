import { cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";

import { getAllOrganizations } from "@/features/organizations/db/organizations";
import { CacheTags } from "@/lib/cache/tags";
import { PageHeader } from "@/components/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AdminOrganizationsPage } from "@/features/organizations/components/AdminOrganizationsPage";

export default async function AdminOrganizationsRoute() {
  const t = await getTranslations();
  const organizations = await fetchOrganizations();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
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