import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { SkeletonProductTable } from "@/components/ui/skeleton";

export default async function ProductsLoadingPage() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-6">
      <PageHeader title={t("admin.products")} description={t("admin.loadingProducts")} />
      <SkeletonProductTable rows={5} showActions />
    </div>
  );
}
