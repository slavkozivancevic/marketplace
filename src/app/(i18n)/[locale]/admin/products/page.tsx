import { Link, getPathname } from "@/i18n/navigation";
import { cacheTag } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { LayoutList } from "lucide-react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createSearchParamsCache } from "nuqs/server";

import { productRepository } from "@/features/products/db/products";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { adminProductSearchParams } from "@/lib/query/searchParams";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { AdminProductsPage } from "@/features/products/components/AdminProductsPage";
import { Button } from "@/components/ui/button";
import { SerializedProductListItem } from "@/types/types";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";
import { ProductStatus } from "@/generated/prisma/client";
import { CacheTags } from "@/lib/cache/tags";
import { getAllBrands } from "@/features/brands/db/brands";

const searchParamsCache = createSearchParamsCache(adminProductSearchParams);

export default async function AdminProductsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminProducts"), href: getPathname({ href: "/admin/products", locale }) },
  ];
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
    brandId: params.brandId,
  };

  const [queryClient, brands] = await Promise.all([
    Promise.resolve(getQueryClient()),
    fetchBrands(),
  ]);

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["products", "admin", filters],
    queryFn: async () => {
      const repo = productRepository(ctx);
      const result = await repo.getAll({
        take: LIST_PAGE_SIZE,
        search: filters.search || undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        status: filters.status.length ? (filters.status as ProductStatus[]) : undefined,
        minPrice: filters.minPrice ?? undefined,
        maxPrice: filters.maxPrice ?? undefined,
        brandId: filters.brandId.length ? filters.brandId : undefined,
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
      <div className="shrink-0 px-6 pt-2">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("admin.products")}
          description={t("admin.productsBrowse")}
        >
          <Button asChild variant="outline">
            <Link href="/admin/products/bulk">
              <LayoutList className="h-4 w-4 mr-1.5" />
              {t("admin.bulkOps")}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/products/new">{t("admin.addProduct")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <AdminProductsPage brands={brands} />
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