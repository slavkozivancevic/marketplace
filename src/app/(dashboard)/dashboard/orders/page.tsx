import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createSearchParamsCache } from "nuqs/server";
import { prisma } from "@/core/db/prisma";
import { getUserOrdersPage } from "@/features/orders/db/orders";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { orderSearchParams } from "@/lib/query/searchParams";
import { PageHeader } from "@/components/PageHeader";
import { OrdersPage } from "@/features/orders/components/OrdersPage";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";

const searchParamsCache = createSearchParamsCache(orderSearchParams);

export default async function OrdersRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
      <div className="shrink-0 px-6">
        <PageHeader title="My Orders" description="Your purchase history." />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <OrdersPage />
        </HydrationBoundary>
      </div>
    </div>
  );
}