import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, getPathname } from "@/i18n/navigation";
import { CouponTableSkeleton } from "@/features/coupons/components/CouponTableSkeleton";

/**
 * Body mirrors <CouponsView>: a `flex flex-wrap items-center gap-3 mb-4` filter
 * row over the table. Control heights are NOT uniform in the real row - the
 * status <Select> is explicitly `h-9` while <SearchInput> and <SortSelect> are
 * the default `h-8` - so the row is 36px tall and the shorter controls are
 * vertically centred inside it.
 */
export default async function AdminCouponsLoading() {
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
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Skeleton className="h-8 flex-1 min-w-40 max-w-sm rounded-lg" />
            <Skeleton className="h-9 w-28 sm:w-36 rounded-lg" />
            <Skeleton className="h-8 w-28 sm:w-44 rounded-lg" />
          </div>
          <CouponTableSkeleton />
        </div>
      </div>
    </div>
  );
}
