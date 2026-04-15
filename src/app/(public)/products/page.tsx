import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createSearchParamsCache } from "nuqs/server";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { getPublicProductsPage } from "@/features/products/db/publicProducts";
import { productSearchParams } from "@/lib/query/searchParams";
import { PageHeader } from "@/components/PageHeader";
import { PublicProductsPage } from "@/features/products/components/PublicProductsPage";
import { Footer } from "@/components/layout/footer";

import { GRID_PAGE_SIZE } from "@/constants/queryConstants";

const searchParamsCache = createSearchParamsCache(productSearchParams);

export default async function ProductsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParamsCache.parse(await searchParams);

  const filters = {
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
  };

  const queryClient = getQueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["products", "public", filters],
    queryFn: () =>
      getPublicProductsPage({
        take: GRID_PAGE_SIZE,
        search: filters.search || undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        minPrice: filters.minPrice ?? undefined,
        maxPrice: filters.maxPrice ?? undefined,
      }),
    initialPageParam: undefined as string | undefined,
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title="Products"
          description="Browse our available products."
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-6 pb-6 pt-1">
          <HydrationBoundary state={dehydrate(queryClient)}>
            <PublicProductsPage />
          </HydrationBoundary>
        </div>
        <Footer />
      </div>
    </div>
  );
}
