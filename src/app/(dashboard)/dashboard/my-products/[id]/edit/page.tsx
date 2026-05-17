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
import { getCategoryTree } from "@/features/categories/db/categories";
import { ProductForm } from "@/features/products/components/ProductForm";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SerializedProductWithRelations } from "@/types/types";

interface MyProductEditPageProps {
  params: Promise<{ id: string }>;
}

async function ProductEditContent({ productId }: { productId: string }) {
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

  if (!canWrite) notFound();

  const [result, brands, categoryTree] = await Promise.all([
    fetchProductForEdit(product.organizationId, user.id, productId),
    fetchBrands(),
    fetchCategoryTree(),
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

  // Fresh key forces the form to remount on each page render. Without this,
  // Next.js (cacheComponents + React Compiler + Router Cache) can preserve the
  // form's in-memory state across navigations, so unsaved edits would still
  // be visible when the user comes back to the edit page.
  return (
    <ProductForm
      key={crypto.randomUUID()}
      mode="update"
      product={productData}
      brands={brands}
      categoryTree={categoryTree}
      redirectTo={`/dashboard/my-products/${productData.id}`}
    />
  );
}

async function fetchBrands() {
  "use cache";
  cacheTag(CacheTags.brands.all());
  return getAllBrands();
}

async function fetchCategoryTree() {
  "use cache";
  cacheTag(CacheTags.categories.all());
  return getCategoryTree();
}

export default async function MyProductEditPage({
  params,
}: MyProductEditPageProps) {
  const t = await getTranslations();
  const { id } = await params;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={t("myProducts.edit")}
          description={t("myProducts.editDesc")}
        >
          <Button asChild variant="outline">
            <Link href={`/dashboard/my-products/${id}`}>{t("myProducts.backToProduct")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6">
        <ProductEditContent productId={id} />
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