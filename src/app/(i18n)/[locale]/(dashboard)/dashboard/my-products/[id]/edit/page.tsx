import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { Link, getPathname } from "@/i18n/navigation";
import { safeAuth } from "@/lib/auth/safeAuth";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/core/db/prisma";

import { productRepository } from "@/features/products/db/products";
import {
  handleActionError,
  isActionErrorResult,
} from "@/features/common/errors/domainErrors";
import { CacheTags } from "@/lib/cache/tags";
import { getAllBrands } from "@/features/brands/db/brands";
import { getCategoryTree } from "@/features/categories/db/categories";
import { getAllTags } from "@/features/tags/db/tags";
import {
  fetchAttributeSelector,
  fetchCategoryAttributeMap,
} from "@/features/attributes/db/formData";
import { ProductFormView } from "@/features/products/components/ProductFormView";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { VerificationRequiredNotice } from "@/components/VerificationRequiredNotice";
import { SerializedProductWithRelations } from "@/types/types";
import { DEFAULT_LOCALE } from "@/i18n/config";

interface MyProductEditPageProps {
  params: Promise<{ id: string }>;
}

async function ProductEditContent({ productId }: { productId: string }) {
  const t = await getTranslations();
  const { userId: clerkUserId } = await safeAuth();
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
    select: { role: true, organization: { select: { verified: true } } },
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

  // Editing is a write action - the server action blocks it for an unverified
  // org, so surface the gate here instead of letting the save fail late.
  if (!membership.organization.verified) {
    return (
      <VerificationRequiredNotice
        title={t("myProducts.verifyRequiredTitle")}
        description={t("myProducts.verifyRequiredDesc")}
      >
        <Button asChild variant="outline" size="sm">
          <Link href={{ pathname: "/dashboard/my-products/[id]", params: { id: productId } }}>
            {t("myProducts.backToProduct")}
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/organization">{t("myProducts.viewOrgStatus")}</Link>
        </Button>
      </VerificationRequiredNotice>
    );
  }

  const [result, brands, categoryTree, tags, attributeLibrary, categoryAttributeMap] =
    await Promise.all([
      fetchProductForEdit(product.organizationId, user.id, productId),
      fetchBrands(),
      fetchCategoryTree(),
      fetchTags(),
      fetchAttributeSelector(),
      fetchCategoryAttributeMap(),
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

  // ProductFormView keys the form on the product id + a navigation counter: stable
  // across the on-mount router.refresh() (no pathname change) but remounts fresh
  // on navigating away and back, so Next's Router Cache can't reopen it with stale
  // unsaved edits.
  return (
    <ProductFormView
      mode="update"
      product={productData}
      brands={brands}
      categoryTree={categoryTree}
      tags={tags}
      attributeLibrary={attributeLibrary}
      categoryAttributeMap={categoryAttributeMap}
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

async function fetchTags() {
  "use cache";
  cacheTag(CacheTags.tags.all());
  return getAllTags();
}

export default async function MyProductEditPage({
  params,
}: MyProductEditPageProps) {
  const t = await getTranslations();
  const tCrumbs = await getTranslations("breadcrumbs");
  const locale = await getLocale();
  const { id } = await params;

  // Cheap, ungated lookup just for the breadcrumb label - the full authorized
  // fetch (org/membership/verification checks) happens deeper in
  // ProductEditContent, too late for the breadcrumb rendered above it. A
  // product's title isn't sensitive (it's already public storefront content),
  // so this doesn't leak anything ProductEditContent's own gates protect.
  const titleProduct = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: { translations: { select: { locale: true, title: true } } },
  });
  const productTitle =
    titleProduct?.translations.find((tr) => tr.locale === locale)?.title ??
    titleProduct?.translations.find((tr) => tr.locale === DEFAULT_LOCALE)?.title ??
    "";

  const breadcrumbItems = [
    { name: tCrumbs("dashboard"), href: getPathname({ href: "/dashboard", locale }) },
    { name: tCrumbs("myProducts"), href: getPathname({ href: "/dashboard/my-products", locale }) },
    {
      name: productTitle || tCrumbs("productDetails"),
      href: getPathname({ href: { pathname: "/dashboard/my-products/[id]", params: { id } }, locale }),
    },
    {
      name: tCrumbs("editProduct"),
      href: getPathname({ href: { pathname: "/dashboard/my-products/[id]/edit", params: { id } }, locale }),
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="shrink-0 px-6 pt-2 sticky-header-bg">
        <Breadcrumbs items={breadcrumbItems} seo={false} />
        <PageHeader
          title={t("myProducts.edit")}
          description={t("myProducts.editDesc")}
        >
          <Button asChild variant="outline">
            <Link href={{ pathname: "/dashboard/my-products/[id]", params: { id } }}>{t("myProducts.backToProduct")}</Link>
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