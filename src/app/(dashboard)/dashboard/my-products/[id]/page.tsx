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
import { getAllBrands } from "@/features/brands/db/brands";
import { ProductForm } from "@/features/products/components/ProductForm";
import { ProductStatusActions } from "@/features/products/components/ProductStatusActions";
import { ProductDetails } from "@/features/products/components/ProductDetails";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SerializedProductWithRelations } from "@/types/types";

interface MyProductEditPageProps {
  params: Promise<{ id: string }>;
}

async function ProductContent({ productId }: { productId: string }) {
  const t = await getTranslations();
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) notFound();

  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
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
      <Alert variant="destructive">
        <AlertTitle>{t("myProducts.wrongOrg")}</AlertTitle>
        <AlertDescription>
          {t("myProducts.wrongOrgDesc")}
        </AlertDescription>
      </Alert>
    );
  }

  const canWrite = membership.role === "OWNER" || membership.role === "ADMIN";

  const [result, brands] = await Promise.all([
    fetchProductForEdit(product.organizationId, user.id, productId),
    fetchBrands(),
  ]);

  if (isActionErrorResult(result)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("myProducts.errorLoading")}</AlertTitle>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
    );
  }

  const productData = result as SerializedProductWithRelations | null;

  if (!productData) notFound();

  if (!canWrite) {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 pb-6 space-y-4">
        <Alert>
          <AlertTitle>{t("myProducts.readOnly")}</AlertTitle>
          <AlertDescription>
            {t("myProducts.readOnlyDesc")}
          </AlertDescription>
        </Alert>
        <ProductDetails product={productData} showActions={false} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between pb-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("myProducts.statusLabel")}</span>
          <span className="text-sm font-medium">{productData.status}</span>
        </div>
        <ProductStatusActions
          productId={productData.id}
          status={productData.status}
          redirectTo={`/dashboard/my-products/${productData.id}`}
        />
      </div>
      <ProductForm
        mode="update"
        product={productData}
        brands={brands}
        redirectTo="/dashboard/my-products"
      />
    </div>
  );
}

async function fetchBrands() {
  "use cache";
  cacheTag(CacheTags.brands.all());
  return getAllBrands();
}

export default async function MyProductPage({
  params,
}: MyProductEditPageProps) {
  const t = await getTranslations();
  const { id } = await params;

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) notFound();

  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: { organizationId: true },
  });

  const user = await prisma.user.findUnique({
    where: { clerkUserId: clerkUserId! },
    select: { id: true, activeOrgId: true },
  });

  const membership =
    product && user
      ? await prisma.membership.findUnique({
          where: {
            userId_orgId: {
              userId: user.id,
              orgId: product.organizationId,
            },
          },
          select: { role: true },
        })
      : null;

  const canWrite = membership?.role === "OWNER" || membership?.role === "ADMIN";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={canWrite ? t("myProducts.edit") : t("myProducts.viewProduct")}
          description={
            canWrite ? t("myProducts.editDesc") : t("myProducts.viewProductDesc")
          }
        >
          <Button asChild variant="outline">
            <Link href="/dashboard/my-products">{t("myProducts.backTo")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6">
        <ProductContent productId={id} />
      </div>
    </div>
  );
}

async function fetchProductForEdit(
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
