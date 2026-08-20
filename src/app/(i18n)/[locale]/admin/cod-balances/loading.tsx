import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { getPathname } from "@/i18n/navigation";
import { AdminCodBalancesSkeleton } from "@/features/payments/components/AdminCodBalancesSkeleton";

/**
 * See the note in ../brands/loading.tsx. This route benefits the most of the
 * three: `getAllCodBalances()` is a live DB aggregate with no `"use cache"`,
 * so the wait is real on every visit.
 */
export default async function AdminCodBalancesLoading() {
  const t = await getTranslations("adminCodBalances");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("codBalances"), href: getPathname({ href: "/admin/cod-balances", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("title")} description={t("description")} />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <AdminCodBalancesSkeleton />
      </div>
    </div>
  );
}
