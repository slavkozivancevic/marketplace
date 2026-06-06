import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createSearchParamsCache } from "nuqs/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { getOrgOrdersPage } from "@/features/orders/db/orgOrders";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { orgOrderSearchParams } from "@/lib/query/searchParams";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { OrgOrdersPage } from "@/features/orders/components/OrgOrdersPage";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";
import { getPathname } from "@/i18n/navigation";

const searchParamsCache = createSearchParamsCache(orgOrderSearchParams);

export async function generateMetadata() {
  const t = await getTranslations("orgOrders");
  return { title: t("pageTitle") };
}

export default async function OrgOrdersRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("orgOrders");
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("organization"), href: getPathname({ href: "/dashboard/organization", locale }) },
    { name: tCrumbs("receivedOrders"), href: getPathname({ href: "/dashboard/organization/orders", locale }) },
  ];

  let ctx;
  try {
    ctx = await resolveRequestContext();
  } catch {
    notFound();
  }


  try {
    requirePermission(ctx, "order:read");
  } catch {
    notFound();
  }

  const params = searchParamsCache.parse(await searchParams);
  const filters = {
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    status: params.status.length > 0 ? params.status : undefined,
  };

  const queryClient = getQueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["orders", "org", { ...filters, status: params.status }],
    queryFn: () =>
      getOrgOrdersPage({
        organizationId: ctx.organizationId,
        take: LIST_PAGE_SIZE,
        ...filters,
      }),
    initialPageParam: undefined as string | undefined,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <OrgOrdersPage />
        </HydrationBoundary>
      </div>
    </div>
  );
}