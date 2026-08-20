import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { getPathname } from "@/i18n/navigation";
import { AuditTableSkeleton } from "@/features/audit/components/AuditTableSkeleton";

/**
 * The widest filter row in the app: search + action select + entity select +
 * sort + two date pickers. The two <DatePicker> triggers and both <Select>s are
 * `h-9`; search and sort are `h-8`.
 *
 * `getAuditFacets()` runs on the server before this page renders, so the wait
 * here is real rather than just a chunk load.
 */
export default async function AdminAuditLoading() {
  const t = await getTranslations("admin.audit");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("audit"), href: getPathname({ href: "/admin/audit", locale }) },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("title")} description={t("description")} />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Skeleton className="h-8 flex-1 min-w-40 max-w-sm rounded-lg" />
            <Skeleton className="h-9 w-28 sm:w-44 rounded-lg" />
            <Skeleton className="h-9 w-28 sm:w-40 rounded-lg" />
            <Skeleton className="h-8 w-28 sm:w-36 rounded-lg" />
            <Skeleton className="h-9 w-32 sm:w-40 rounded-lg" />
            <Skeleton className="h-9 w-32 sm:w-40 rounded-lg" />
          </div>
          <AuditTableSkeleton />
        </div>
      </div>
    </div>
  );
}
