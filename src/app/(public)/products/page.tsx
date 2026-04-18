import { cacheTag } from "next/cache";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createSearchParamsCache } from "nuqs/server";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { getPublicProductsPage } from "@/features/products/db/publicProducts";
import { productSearchParams } from "@/lib/query/searchParams";
import { PageHeader } from "@/components/PageHeader";
import { PublicProductsPage } from "@/features/products/components/PublicProductsPage";
import { Footer } from "@/components/layout/footer";
import { CacheTags } from "@/lib/cache/tags";
import { getAllBrands } from "@/features/brands/db/brands";

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
    onSale: params.onSale,
    isDigital: params.isDigital,
    brandId: params.brandId,
  };

  const [queryClient, brands] = await Promise.all([
    Promise.resolve(getQueryClient()),
    fetchBrands(),
  ]);

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
        onSale: filters.onSale,
        isDigital: filters.isDigital,
        brandId: filters.brandId ?? undefined,
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
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <PublicProductsPage brands={brands} footer={<Footer />} />
        </HydrationBoundary>
      </div>
    </div>
  );
}

async function fetchBrands() {
  "use cache";
  cacheTag(CacheTags.brands.all());
  return getAllBrands();
}
