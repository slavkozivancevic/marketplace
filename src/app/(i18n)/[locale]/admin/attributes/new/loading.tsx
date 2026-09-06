import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SkeletonBreadcrumbs } from "@/components/ui/skeleton";
import { AttributeFormSkeleton } from "@/features/attributes/components/AttributeFormSkeleton";

export default async function NewAttributeLoadingPage() {
  const t = await getTranslations("adminAttributes");
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs segments={3} />
        <PageHeader title={t("createTitle")} description={t("createDesc")}>
          <Button asChild variant="outline">
            <Link href="/admin/attributes">{t("back")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <AttributeFormSkeleton />
      </div>
    </div>
  );
}
