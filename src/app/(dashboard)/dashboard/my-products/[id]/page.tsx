import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";

import { productRepository } from "@/features/products/db/products";
import {
  handleActionError,
  isActionErrorResult,
} from "@/features/common/errors/domainErrors";
import { CacheTags } from "@/lib/cache/tags";
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
        <AlertTitle>Wrong organization context</AlertTitle>
        <AlertDescription>
          This product belongs to a different organization. Please switch to the
          correct organization from the dashboard sidebar before editing.
        </AlertDescription>
      </Alert>
    );
  }

  const canWrite = membership.role === "OWNER" || membership.role === "ADMIN";

  const result = await fetchProductForEdit(
    product.organizationId,
    user.id,
    productId,
  );

  if (isActionErrorResult(result)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error loading product</AlertTitle>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
    );
  }

  const productData = result as SerializedProductWithRelations | null;

  if (!productData) notFound();

  if (!canWrite) {
    return (
      <div className="space-y-4">
        <Alert>
          <AlertTitle>Read-only access</AlertTitle>
          <AlertDescription>
            You are a member of this organization but do not have permission to
            edit products. Contact an owner or admin to request access.
          </AlertDescription>
        </Alert>
        <ProductDetails product={productData} showActions={false} />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
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
        redirectTo="/dashboard/my-products"
      />
    </>
  );
}

export default async function MyProductPage({
  params,
}: MyProductEditPageProps) {
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
          title={canWrite ? "Edit Product" : "View Product"}
          description={
            canWrite ? "Update the product details." : "View product details."
          }
        >
          <Button asChild variant="outline">
            <Link href="/dashboard/my-products">Back to My Products</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
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
      variants: result.variants.map((v) => ({
        ...v,
        price: Number(v.price),
      })),
    };
  } catch (error) {
    return handleActionError(error);
  }
}
