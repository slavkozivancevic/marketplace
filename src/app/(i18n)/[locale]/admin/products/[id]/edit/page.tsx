import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { Link, getPathname } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { productRepository } from "@/features/products/db/products";
import {
  handleActionError,
  isActionErrorResult,
} from "@/features/common/errors/domainErrors";
import { CacheTags } from "@/lib/cache/tags";
import { ProductFormView } from "@/features/products/components/ProductFormView";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SerializedProductWithRelations } from "@/types/types";
import { getAllBrands } from "@/features/brands/db/brands";
import { getCategoryTree } from "@/features/categories/db/categories";
import { getAllTags } from "@/features/tags/db/tags";
import {
  fetchAttributeSelector,
  fetchCategoryAttributeMap,
} from "@/features/attributes/db/formData";
import { DEFAULT_LOCALE } from "@/i18n/config";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
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

async function fetchTags() {
  "use cache";
  cacheTag(CacheTags.tags.all());
  return getAllTags();
}

export default async function EditProductPage({
  params,
}: EditProductPageProps) {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const { id } = await params;

  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  const [result, brands, categoryTree, tags, attributeLibrary, categoryAttributeMap] =
    await Promise.all([
      fetchProductForEdit(ctx.organizationId, ctx.userId, id),
      fetchBrands(),
      fetchCategoryTree(),
      fetchTags(),
      fetchAttributeSelector(),
      fetchCategoryAttributeMap(),
    ]);

  const breadcrumbItems = [
    { name: tCrumbs("admin"), href: getPathname({ href: "/admin", locale }) },
    { name: tCrumbs("adminProducts"), href: getPathname({ href: "/admin/products", locale }) },
    {
      name: tCrumbs("productDetails"),
      href: getPathname({ href: { pathname: "/admin/products/[id]", params: { id } }, locale }),
    },
    {
      name: tCrumbs("editProduct"),
      href: getPathname({ href: { pathname: "/admin/products/[id]/edit", params: { id } }, locale }),
    },
  ];

  if (isActionErrorResult(result)) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="shrink-0 px-6 pt-2 sticky-header-bg">
          <Breadcrumbs items={breadcrumbItems} seo={false} />
          <PageHeader title={t("admin.errorLoading")} />
        </div>
        <div className="flex-1 flex flex-col min-h-0 px-6">
          <Alert variant="destructive">
            <AlertTitle>{t("admin.errorLoading")}</AlertTitle>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const product = result as SerializedProductWithRelations | null;

  if (!product) notFound();

  const title =
    product.translations.find((tr) => tr.locale === locale)?.title ??
    product.translations.find((tr) => tr.locale === DEFAULT_LOCALE)?.title ??
    "";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("admin.editProduct", { title })}
          description={t("admin.editProductDesc")}
        >
          <Button asChild variant="outline">
            <Link href={{ pathname: "/admin/products/[id]", params: { id } }}>{t("admin.backToProduct")}</Link>
          </Button>
        </PageHeader>
      </div>
      <div className="flex-1 flex flex-col min-h-0 px-6">
        {/* ProductFormView keys the form on the product id + a client-side
            navigation counter, so it stays mounted across the on-mount
            router.refresh() (no pathname change) but remounts fresh when the
            user navigates away and back - otherwise Next's Router Cache
            restores the form with stale unsaved edits. */}
        <ProductFormView
          mode="update"
          product={product}
          brands={brands}
          categoryTree={categoryTree}
          tags={tags}
          attributeLibrary={attributeLibrary}
          categoryAttributeMap={categoryAttributeMap}
        />
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
