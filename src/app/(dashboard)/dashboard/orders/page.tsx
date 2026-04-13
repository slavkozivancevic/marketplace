import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { prisma } from "@/core/db/prisma";
import { getUserOrdersPage } from "@/features/orders/db/orders";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { PageHeader } from "@/components/PageHeader";
import { OrdersList } from "@/features/orders/components/OrdersList";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";

export default async function OrdersPage() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) notFound();

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) notFound();

  const queryClient = getQueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["orders", "user"],
    queryFn: () => getUserOrdersPage({ userId: user.id, take: LIST_PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader title="My Orders" description="Your purchase history." />
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <OrdersList />
        </HydrationBoundary>
      </div>
    </div>
  );
}
