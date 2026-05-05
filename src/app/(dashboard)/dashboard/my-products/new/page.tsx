import { getTranslations } from "next-intl/server";
import { ProductForm } from "@/features/products/components/ProductForm";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function NewMyProductPage() {
  const t = await getTranslations();
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={t("myProducts.createNew")}
          description={t("myProducts.createNewDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/dashboard/my-products">{t("myProducts.backTo")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6">
        <ProductForm mode="create" redirectTo="/dashboard/my-products" />
      </div>
    </div>
  );
}
