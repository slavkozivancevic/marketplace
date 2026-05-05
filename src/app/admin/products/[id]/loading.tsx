import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonProductCard } from "@/components/ui/skeleton";

export default async function ProductDetailsLoadingPage() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6">
      <PageHeader
        title={t("admin.productDetails")}
        description={t("common.loadingDetails")}
      />
      <SkeletonProductCard />
    </div>
  );
}
