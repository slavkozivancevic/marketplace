import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Link, getPathname } from "@/i18n/navigation";
import { CouponsView } from "@/features/coupons/components/CouponsView";

export default async function AdminCouponsRoute() {
  await connection();
  const t = await getTranslations("coupons");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("coupons"), href: getPathname({ href: "/admin/coupons", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("title")} description={t("description")}>
          <Button asChild>
            <Link href="/admin/coupons/new">{t("addCoupon")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <CouponsView />
      </div>
    </div>
  );
}
