import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import {
  Skeleton,
  SkeletonArray,
  SkeletonBreadcrumbs,
  SkeletonFilterSidebar,
  SkeletonOrganizationCard,
} from "@/components/ui/skeleton";

export default async function AdminOrganizationsLoading() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs />
        <PageHeader
          title={t("admin.manageOrgs")}
          description={t("admin.manageOrgsDesc")}
        />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <div className="flex gap-6 flex-1 min-h-0">
          <SkeletonFilterSidebar groups={2} />
          <div className="flex-1 min-w-0 flex flex-col gap-4 min-h-0">
            <Skeleton className="h-9 w-full max-w-sm rounded-md" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SkeletonArray amount={4}>
                <SkeletonOrganizationCard />
              </SkeletonArray>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
