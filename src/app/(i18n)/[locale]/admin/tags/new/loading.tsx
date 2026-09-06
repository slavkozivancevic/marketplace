import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SkeletonBreadcrumbs } from "@/components/ui/skeleton";
import { TagFormSkeleton } from "@/features/tags/components/TagFormSkeleton";

export default async function NewTagLoadingPage() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs segments={3} />
        <PageHeader
          title={t("admin.createTag")}
          description={t("admin.createTagDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/admin/tags">{t("admin.backToTags")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <TagFormSkeleton />
      </div>
    </div>
  );
}
