import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Link, getPathname } from "@/i18n/navigation";
import { CouponForm } from "@/features/coupons/components/CouponForm";

export default async function NewCouponRoute() {
  const t = await getTranslations("coupons");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("coupons"), href: getPathname({ href: "/admin/coupons", locale }) },
    { name: tCrumbs("newCoupon"), href: getPathname({ href: "/admin/coupons/new", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("newCoupon")} description={t("formDescription")}>
          <Button asChild variant="outline">
            <Link href="/admin/coupons">{t("back")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <CouponForm />
      </div>
    </div>
  );
}
