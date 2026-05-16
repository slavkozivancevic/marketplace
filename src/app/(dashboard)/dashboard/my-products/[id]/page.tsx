import { Suspense } from "react";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/core/db/prisma";

import { productRepository } from "@/features/products/db/products";
import {
  handleActionError,
  isActionErrorResult,
} from "@/features/common/errors/domainErrors";
import { CacheTags } from "@/lib/cache/tags";
import { ProductDetails } from "@/features/products/components/ProductDetails";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SkeletonProductCard } from "@/components/ui/skeleton";
import { SerializedProductWithRelations } from "@/types/types";

interface MyProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function MyProductPage({ params }: MyProductPageProps) {
  const { id } = await params;
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Suspense fallback={<MyProductLoading />}>
        <MyProductContent id={id} />
      </Suspense>
    </div>
  );
}

async function MyProductLoading() {
  const t = await getTranslations();
  return (
    <>
      <div className="shrink-0 px-6">
        <PageHeader
          title={t("myProducts.viewProduct")}
          description={t("myProducts.viewProductDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/dashboard/my-products">{t("myProducts.backTo")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <SkeletonProductCard />
      </div>
    </>
  );
}

async function MyProductContent({ id }: { id: string }) {
  const t = await getTranslations();

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) notFound();

  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: { organizationId: true },
  });

  if (!product) notFound();

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, activeOrgId: true },
  });

  if (!user) notFound();

  const membership = await prisma.membership.findUnique({
    where: {
      userId_orgId: {
        userId: user.id,
        orgId: product.organizationId,
      },
    },
    select: { role: true },
  });

  if (!membership) notFound();

  if (user.activeOrgId !== product.organizationId) {
    return (
      <>
        <div className="shrink-0 px-6">
          <PageHeader
            title={t("myProducts.viewProduct")}
            description={t("myProducts.viewProductDesc")}
          >
            <Button asChild variant="outline">
              <Link href="/dashboard/my-products">{t("myProducts.backTo")}</Link>
            </Button>
          </PageHeader>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
          <Alert variant="destructive">
            <AlertTitle>{t("myProducts.wrongOrg")}</AlertTitle>
            <AlertDescription>{t("myProducts.wrongOrgDesc")}</AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  const canWrite = membership.role === "OWNER" || membership.role === "ADMIN";

  const result = await fetchProduct(product.organizationId, user.id, id);

  if (isActionErrorResult(result)) {
    return (
      <>
        <div className="shrink-0 px-6">
          <PageHeader
            title={t("myProducts.viewProduct")}
            description={t("myProducts.viewProductDesc")}
          >
            <Button asChild variant="outline">
              <Link href="/dashboard/my-products">{t("myProducts.backTo")}</Link>
            </Button>
          </PageHeader>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
          <Alert variant="destructive">
            <AlertTitle>{t("myProducts.errorLoading")}</AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        </div>
      </>
    );
  }

  const productData = result as SerializedProductWithRelations | null;
  if (!productData) notFound();

  return (
    <>
      <div className="shrink-0 px-6">
        <PageHeader
          title={productData.title}
          description={t("myProducts.viewProductDesc")}
        >
          <Button asChild variant="outline">
            <Link href="/dashboard/my-products">{t("myProducts.backTo")}</Link>
          </Button>
          {canWrite && (
            <Button asChild>
              <Link href={`/dashboard/my-products/${id}/edit`}>{t("common.edit")}</Link>
            </Button>
          )}
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
        <ProductDetails
          product={productData}
          showActions={canWrite}
          redirectTo="/dashboard/my-products"
        />
      </div>
    </>
  );
}

async function fetchProduct(
  organizationId: string,
  userId: string,
  id: string,
): Promise<
  SerializedProductWithRelations | null | { error: boolean; message: string }
> {
  "use cache";
  cacheTag(CacheTags.products.byId(organizationId, id));
  try {
    const repo = productRepository({ organizationId, userId });
    const result = await repo.getById(id);

    if (!result) return null;

    return {
      ...result,
      price: Number(result.price),
      compareAtPrice: result.compareAtPrice != null ? Number(result.compareAtPrice) : null,
      costPrice: result.costPrice != null ? Number(result.costPrice) : null,
      variants: result.variants.map((v) => ({
        ...v,
        price: Number(v.price),
        compareAtPrice: v.compareAtPrice != null ? Number(v.compareAtPrice) : null,
        costPrice: v.costPrice != null ? Number(v.costPrice) : null,
      })),
    };
  } catch (error) {
    return handleActionError(error);
  }
}