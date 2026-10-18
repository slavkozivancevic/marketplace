import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SkeletonBreadcrumbs } from "@/components/ui/skeleton";
import { TrustPointFormSkeleton } from "@/features/trustPoints/components/TrustPointFormSkeleton";

export default async function NewTrustPointLoading() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        {/* admin / trust points / new */}
        <SkeletonBreadcrumbs segments={3} />
        <PageHeader
          title={t("admin.createTrustPoint")}
          description={t("admin.createTrustPointDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/admin/trust-points">{t("admin.backToTrustPoints")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <TrustPointFormSkeleton />
      </div>
    </div>
  );
}
