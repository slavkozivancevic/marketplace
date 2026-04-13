import Link from "next/link";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { productRepository } from "@/features/products/db/products";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { PageHeader } from "@/components/PageHeader";
import { AdminProductsList } from "@/features/products/components/AdminProductsList";
import { Button } from "@/components/ui/button";
import { SerializedProductListItem } from "@/types/types";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";

export default async function AdminProductsPage() {
  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  const queryClient = getQueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["products", "admin"],
    queryFn: async () => {
      const repo = productRepository(ctx);
      const result = await repo.getAll({ take: LIST_PAGE_SIZE });
      return {
        items: result.products.map((p): SerializedProductListItem => ({
          ...p,
          price: Number(p.price),
        })),
        nextCursor: result.nextCursor,
      };
    },
    initialPageParam: undefined as string | undefined,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title="Products"
          description="Browse and manage your product catalog."
        >
          <Button asChild>
            <Link href="/admin/products/new">Add Product</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <AdminProductsList />
        </HydrationBoundary>
      </div>
    </div>
  );
}
