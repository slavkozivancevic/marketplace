import { getTranslations } from "next-intl/server";
import { NotFoundContent } from "@/components/layout/not-found-content";

export default async function ProductsNotFoundPage() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex-1 flex items-center justify-center min-h-0 overflow-y-auto px-6 py-12">
      <NotFoundContent
        eyebrow={t("title")}
        heading={t("page")}
        description={t("productResource")}
        backHref="/admin/products"
        backLabel={t("backToProducts")}
      />
    </div>
  );
}