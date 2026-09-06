import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SkeletonBreadcrumbs } from "@/components/ui/skeleton";
import { CategoryFormSkeleton } from "@/features/categories/components/CategoryFormSkeleton";

export default async function NewCategoryLoadingPage() {
  const t = await getTranslations("adminCategories");
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <SkeletonBreadcrumbs segments={3} />
        <PageHeader title={t("createTitle")} description={t("createDesc")}>
          <Button asChild variant="outline">
            <Link href="/admin/categories">{t("back")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <CategoryFormSkeleton />
      </div>
    </div>
  );
}
