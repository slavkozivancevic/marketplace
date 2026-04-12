import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { prisma } from "@/core/db/prisma";
import { productRepository } from "@/features/products/db/products";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { MyProductsGrid } from "@/features/products/components/MyProductsGrid";
import { GRID_PAGE_SIZE } from "@/constants/queryConstants";
import { SerializedProductListItem } from "@/types/types";

export default async function MyProductsPage() {
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

  const queryClient = getQueryClient();
  const orgId = user.activeOrgId;

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["products", "my-products"],
    queryFn: async () => {
      const repo = productRepository({
        organizationId: orgId,
        userId: user.id,
      });
      const result = await repo.getAll({ take: GRID_PAGE_SIZE });
      return {
        items: result.products.map(
          (p): SerializedProductListItem => ({
            ...p,
            price: Number(p.price),
          }),
        ),
        nextCursor: result.nextCursor,
      };
    },
    initialPageParam: undefined as string | undefined,
  });

  return (
    <div className="container">
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

      <HydrationBoundary state={dehydrate(queryClient)}>
        <MyProductsGrid canWrite={canWrite} />
      </HydrationBoundary>
    </div>
  );
}
