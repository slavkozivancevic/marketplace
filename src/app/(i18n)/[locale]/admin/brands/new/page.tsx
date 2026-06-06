import { Link, getPathname } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { BrandForm } from "@/features/brands/components/BrandForm";

export default async function NewBrandPage() {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminBrands"), href: getPathname({ href: "/admin/brands", locale }) },
    { name: tCrumbs("newBrand"), href: getPathname({ href: "/admin/brands/new", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
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
