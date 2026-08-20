import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import {
  SkeletonActiveFiltersSpacer,
  SkeletonArray,
  SkeletonBreadcrumbs,
  SkeletonFilterSidebar,
  SkeletonOrganizationCard,
  SkeletonSearchCountToolbar,
} from "@/components/ui/skeleton";

/**
 * Body mirrors <AdminOrganizationsPage> exactly. Three things this file used to
 * get wrong and that are easy to reintroduce:
 *  - the content column is `gap-3`, not `gap-4`;
 *  - the collapsed <ActiveFilters> box sits between toolbar and list and still
 *    eats one 12px gap even at zero height;
 *  - the card grid lives inside its own `flex-1 min-h-0 overflow-y-auto pb-6`
 *    scroller, so the cards - not the page - are what scrolls.
 */
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
          {/* One facet: verification (verified / unverified). */}
          <SkeletonFilterSidebar groups={[2]} />
          <div className="flex-1 min-w-0 flex flex-col min-h-0 gap-3">
            <SkeletonSearchCountToolbar />
            <SkeletonActiveFiltersSpacer />
            <div className="flex-1 min-h-0 overflow-y-auto pb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SkeletonArray amount={4}>
                  <SkeletonOrganizationCard />
                </SkeletonArray>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
