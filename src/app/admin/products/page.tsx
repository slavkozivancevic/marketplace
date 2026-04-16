import Link from "next/link";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createSearchParamsCache } from "nuqs/server";

import { productRepository } from "@/features/products/db/products";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { adminProductSearchParams } from "@/lib/query/searchParams";
import { PageHeader } from "@/components/PageHeader";
import { AdminProductsPage } from "@/features/products/components/AdminProductsPage";
import { Button } from "@/components/ui/button";
import { SerializedProductListItem } from "@/types/types";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";
import { ProductStatus } from "@/generated/prisma/client";

const searchParamsCache = createSearchParamsCache(adminProductSearchParams);

export default async function AdminProductsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  const params = searchParamsCache.parse(await searchParams);

  const filters = {
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    status: params.status,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
  };

  const queryClient = getQueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["products", "admin", filters],
    queryFn: async () => {
      const repo = productRepository(ctx);
      const result = await repo.getAll({
        take: LIST_PAGE_SIZE,
        search: filters.search || undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        status: (filters.status[0] as ProductStatus) || undefined,
        minPrice: filters.minPrice ?? undefined,
        maxPrice: filters.maxPrice ?? undefined,
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
          <AdminProductsPage />
        </HydrationBoundary>
      </div>
    </div>
  );
}