import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import {
  SkeletonActiveFiltersSpacer,
  SkeletonArray,
  SkeletonBreadcrumbs,
  SkeletonFilterSidebar,
  SkeletonSearchCountToolbar,
  SkeletonUserRow,
} from "@/components/ui/skeleton";

/** Same body shape as ../organizations/loading.tsx - see the note there. */
export default async function AdminUsersLoading() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs />
        <PageHeader
          title={t("admin.manageUsers")}
          description={t("admin.manageUsersDesc")}
        />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6">
        <div className="flex gap-6 flex-1 min-h-0">
          {/* One facet: role (user / seller / admin). */}
          <SkeletonFilterSidebar groups={[3]} />
          <div className="flex-1 min-w-0 flex flex-col min-h-0 gap-3">
            <SkeletonSearchCountToolbar />
            <SkeletonActiveFiltersSpacer />
            <div className="flex-1 min-h-0 overflow-y-auto pb-6">
              <div className="space-y-4">
                <SkeletonArray amount={6}>
                  <SkeletonUserRow />
                </SkeletonArray>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
