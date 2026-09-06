import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { FilterListPageSkeleton } from "@/components/search/FilterListPageSkeleton";
import { OrgOrderTableSkeleton } from "@/features/orders/components/OrderTableSkeleton";

/** One filter group: order status, 7 fixed options. */
export default async function OrgOrdersLoading() {
  const t = await getTranslations("orgOrders");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("receivedOrders"), href: getPathname({ href: "/dashboard/organization/orders", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <FilterListPageSkeleton groups={[7]}>
          <OrgOrderTableSkeleton />
        </FilterListPageSkeleton>
      </div>
    </div>
  );
}
