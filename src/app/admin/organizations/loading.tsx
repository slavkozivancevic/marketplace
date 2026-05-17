import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import {
  SkeletonArray,
  SkeletonFilteredListPage,
  SkeletonOrganizationCard,
} from "@/components/ui/skeleton";

export default async function AdminOrganizationsLoading() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={t("admin.manageOrgs")}
          description={t("admin.manageOrgsDesc")}
        />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6">
        <SkeletonFilteredListPage>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonArray amount={4}>
              <SkeletonOrganizationCard />
            </SkeletonArray>
          </div>
        </SkeletonFilteredListPage>
      </div>
    </div>
  );
}
