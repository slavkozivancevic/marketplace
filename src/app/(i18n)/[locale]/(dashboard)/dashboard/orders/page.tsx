import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createSearchParamsCache } from "nuqs/server";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/core/db/prisma";
import { getUserOrdersPage } from "@/features/orders/db/orders";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { orderSearchParams } from "@/lib/query/searchParams";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { OrdersPage } from "@/features/orders/components/OrdersPage";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";
import { getPathname } from "@/i18n/navigation";

const searchParamsCache = createSearchParamsCache(orderSearchParams);

export default async function OrdersRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("myOrders"), href: getPathname({ href: "/dashboard/orders", locale }) },
  ];
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) notFound();

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) notFound();

  const params = searchParamsCache.parse(await searchParams);

  const filters = {
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    status: params.status,
  };

  const queryClient = getQueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["orders", "user", filters],
    queryFn: () =>
      getUserOrdersPage({
        userId: user.id,
        take: LIST_PAGE_SIZE,
        search: filters.search || undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        status: filters.status.length > 0 ? filters.status : undefined,
      }),
    initialPageParam: undefined as string | undefined,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader title={t("orders.title")} description={t("orders.history")} />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <OrdersPage />
        </HydrationBoundary>
      </div>
    </div>
  );
}