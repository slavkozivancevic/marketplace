import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { productRepository } from "@/features/products/db/products";
import {
  handleActionError,
  isActionErrorResult,
} from "@/features/common/errors/domainErrors";
import { CacheTags } from "@/lib/cache/tags";
import { ProductForm } from "@/features/products/components/ProductForm";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SerializedProductWithRelations } from "@/types/types";
import { getAllBrands } from "@/features/brands/db/brands";
import { getCategoryTree } from "@/features/categories/db/categories";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

async function EditProductForm({ productId }: { productId: string }) {
  const t = await getTranslations();
  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  const [result, brands, categoryTree] = await Promise.all([
    fetchProductForEdit(ctx.organizationId, ctx.userId, productId),
    fetchBrands(),
    fetchCategoryTree(),
  ]);

  if (isActionErrorResult(result)) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("admin.errorLoading")}</AlertTitle>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
    );
  }

  const product = result as SerializedProductWithRelations | null;

  if (!product) notFound();

  // Fresh key forces the form to remount on each page render. Without this,
  // Next.js (cacheComponents + React Compiler + Router Cache) can preserve the
  // form's in-memory state across navigations, so unsaved edits would still
  // be visible when the user comes back to the edit page.
  return (
    <ProductForm
      key={crypto.randomUUID()}
      mode="update"
      product={product}
      brands={brands}
      categoryTree={categoryTree}
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

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const t = await getTranslations();
  const { id } = await params;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6">
        <PageHeader
          title={t("admin.editProduct")}
          description={t("admin.editProductDesc")}
        >
          <Button asChild variant="outline">
            <Link href={`/admin/products/${id}`}>{t("admin.backToProduct")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6">
        <EditProductForm productId={id} />
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
