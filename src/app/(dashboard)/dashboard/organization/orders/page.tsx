import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createSearchParamsCache } from "nuqs/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { getOrgOrdersPage } from "@/features/orders/db/orgOrders";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { orgOrderSearchParams } from "@/lib/query/searchParams";
import { PageHeader } from "@/components/PageHeader";
import { OrgOrdersPage } from "@/features/orders/components/OrgOrdersPage";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";

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
      <div className="shrink-0 px-6">
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