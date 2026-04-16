import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createSearchParamsCache } from "nuqs/server";
import { prisma } from "@/core/db/prisma";
import { productRepository } from "@/features/products/db/products";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { myProductSearchParams } from "@/lib/query/searchParams";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { MyProductsPage } from "@/features/products/components/MyProductsPage";
import { GRID_PAGE_SIZE } from "@/constants/queryConstants";
import { SerializedProductListItem } from "@/types/types";
import { ProductStatus } from "@/generated/prisma/client";

const searchParamsCache = createSearchParamsCache(myProductSearchParams);

export default async function MyProductsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { userId } = await auth();

  const user = await prisma.user.findUnique({
    where: { clerkUserId: userId! },
    select: {
      id: true,
      role: true,
      activeOrgId: true,
      memberships: {
        select: { orgId: true, role: true },
      },
    },
  });

  if (!user || user.role !== "SELLER") {
    redirect("/dashboard");
  }

  if (!user.activeOrgId) {
    redirect("/dashboard");
  }

  const activeMembership = user.memberships.find(
    (m) => m.orgId === user.activeOrgId,
  );

  const canWrite =
    activeMembership?.role === "OWNER" || activeMembership?.role === "ADMIN";

  const params = searchParamsCache.parse(await searchParams);

  const filters = {
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    status: params.status,
  };

  const queryClient = getQueryClient();
  const orgId = user.activeOrgId;

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["products", "my-products", filters],
    queryFn: async () => {
      const repo = productRepository({
        organizationId: orgId,
        userId: user.id,
      });
      const result = await repo.getAll({
        take: GRID_PAGE_SIZE,
        search: filters.search || undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        status: (filters.status[0] as ProductStatus) || undefined,
      });
      return {
        items: result.products.map(
          (p): SerializedProductListItem => ({
            ...p,
            price: Number(p.price),
            compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
            costPrice: p.costPrice != null ? Number(p.costPrice) : null,
          }),
        ),
        nextCursor: result.nextCursor,
      };
    },
    initialPageParam: undefined as string | undefined,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title="My Products"
          description="Manage your product listings."
        >
          {canWrite && (
            <Button asChild>
              <Link href="/dashboard/my-products/new">Create Product</Link>
            </Button>
          )}
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <MyProductsPage canWrite={canWrite} />
        </HydrationBoundary>
      </div>
    </div>
  );
}