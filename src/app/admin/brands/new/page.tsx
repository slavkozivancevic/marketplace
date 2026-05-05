import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { BrandForm } from "@/features/brands/components/BrandForm";

export default async function NewBrandPage() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={t("admin.createBrand")}
          description={t("admin.createBrandDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/admin/brands">{t("admin.backToBrands")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <BrandForm mode="create" />
      </div>
    </div>
  );
}