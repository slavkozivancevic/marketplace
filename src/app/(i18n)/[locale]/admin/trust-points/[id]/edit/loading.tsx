import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SkeletonBreadcrumbs } from "@/components/ui/skeleton";
import { TrustPointFormSkeleton } from "@/features/trustPoints/components/TrustPointFormSkeleton";

/** Name-less title: the record is exactly what is still loading, so the header
 *  uses the generic string rather than a placeholder bar that would swap for
 *  text of a different width. Same call as the tag and brand edit pages. */
export default async function EditTrustPointLoading() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        {/* admin / trust points / edit */}
        <SkeletonBreadcrumbs segments={3} />
        <PageHeader
          title={t("admin.editTrustPointLoading")}
          description={t("admin.editTrustPointDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/admin/trust-points">{t("admin.backToTrustPoints")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <TrustPointFormSkeleton mode="edit" />
      </div>
    </div>
  );
}
