import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonHistoryTable } from "@/components/ui/skeleton";

export default async function ProductHistoryLoadingPage() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6">
      <PageHeader
        title={t("admin.historyTitle")}
        description={t("admin.loadingHistory")}
      />
      <div className="mt-4">
        <SkeletonHistoryTable rows={5} />
      </div>
    </div>
  );
}
