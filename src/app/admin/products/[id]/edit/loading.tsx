import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { SkeletonProductForm } from "@/components/ui/skeleton";

export default async function EditProductLoadingPage() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={t("admin.editProduct")}
          description={t("admin.editProductDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/admin/products">{t("admin.backToProducts")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6">
        <SkeletonProductForm />
      </div>
    </div>
  );
}