import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createSearchParamsCache } from "nuqs/server";
import { cacheTag } from "next/cache";
import { prisma } from "@/core/db/prisma";
import { productRepository } from "@/features/products/db/products";
import { getQueryClient } from "@/lib/query/getQueryClient";
import { myProductSearchParams } from "@/lib/query/searchParams";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Link, getPathname } from "@/i18n/navigation";
import { MyProductsPage } from "@/features/products/components/MyProductsPage";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";
import { SerializedProductListItem } from "@/types/types";
import { ProductStatus } from "@/generated/prisma/client";
import { getAllBrands } from "@/features/brands/db/brands";
import { CacheTags } from "@/lib/cache/tags";

const searchParamsCache = createSearchParamsCache(myProductSearchParams);

async function fetchBrands() {
  "use cache";
  cacheTag(CacheTags.brands.all());
  return getAllBrands();
}

export default async function MyProductsRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const { userId } = await auth();
  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("myProducts"), href: getPathname({ href: "/dashboard/my-products", locale }) },
  ];

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
    redirect(`/${locale}/dashboard`);
  }

  if (!user.activeOrgId) {
    redirect(`/${locale}/dashboard`);
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
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    brandId: params.brandId,
  };

  const [queryClient, brands] = await Promise.all([
    Promise.resolve(getQueryClient()),
    fetchBrands(),
  ]);

  const orgId = user.activeOrgId;

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["products", "my-products", orgId, filters],
    queryFn: async () => {
      const repo = productRepository({
        organizationId: orgId,
        userId: user.id,
      });
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
          title={t("myProducts.title")}
          description={t("myProducts.manage")}
        >
          {canWrite && (
            <Button asChild>
              <Link href="/dashboard/my-products/new">{t("myProducts.create")}</Link>
            </Button>
          )}
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <MyProductsPage canWrite={canWrite} brands={brands} />
        </HydrationBoundary>
      </div>
    </div>
  );
}