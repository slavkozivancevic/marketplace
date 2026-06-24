import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { getPathname } from "@/i18n/navigation";
import { getCouponById } from "@/features/coupons/db/coupons";
import { CouponForm } from "@/features/coupons/components/CouponForm";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCouponRoute({ params }: Props) {
  const t = await getTranslations("coupons");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const { id } = await params;

  const coupon = await getCouponById(id);
  if (!coupon) notFound();

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("coupons"), href: getPathname({ href: "/admin/coupons", locale }) },
    {
      name: tCrumbs("editCoupon"),
      href: getPathname({ href: { pathname: "/admin/coupons/[id]/edit", params: { id } }, locale }),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={`${t("editCoupon")}: ${coupon.code}`} description={t("formDescription")} />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <CouponForm
          coupon={{
            id: coupon.id,
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
            minOrder: coupon.minOrder,
            usageLimit: coupon.usageLimit,
            expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString() : null,
            active: coupon.active,
          }}
        />
      </div>
    </div>
  );
}
