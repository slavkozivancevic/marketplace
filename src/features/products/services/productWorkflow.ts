import { ProductStatus } from "@/generated/prisma/client";
import { RequestContext } from "@/types/types";
import { productRepository } from "../db/products";
import { requirePermission } from "@/lib/auth/permissions";
import {
  ForbiddenError,
  NotFoundError,
} from "@/features/common/errors/domainErrors";
import { DEFAULT_LOCALE } from "@/i18n/config";

function assertCanPublish(product: {
  translations: { locale: string; title: string; description: string }[];
  price: unknown;
  media: { key: string }[];
}) {
  // Publish gate runs against the default-locale translation row: it's the
  // canonical content the product is required to have. Sellers can still
  // ship missing non-default translations and fill them in later via the
  // translations tab.
  const defaultRow =
    product.translations.find((t) => t.locale === DEFAULT_LOCALE) ??
    product.translations[0];

  if (!defaultRow?.title.trim()) {
    throw new ForbiddenError({ key: "productTitleRequiredBeforePublish" });
  }

  if (!defaultRow.description.trim()) {
    throw new ForbiddenError({ key: "productDescriptionRequiredBeforePublish" });
  }

  if (!product.price || (product.price as number) <= 0) {
    throw new ForbiddenError({ key: "productPriceRequiredBeforePublish" });
  }

  if (product.media.length === 0) {
    throw new ForbiddenError({ key: "productMediaRequiredBeforePublish" });
  }
}

function assertStatusTransition(current: ProductStatus, next: ProductStatus) {
  const allowed: Record<ProductStatus, ProductStatus[]> = {
    DRAFT: [ProductStatus.PUBLISHED],
    PUBLISHED: [ProductStatus.DRAFT, ProductStatus.ARCHIVED],
    ARCHIVED: [ProductStatus.DRAFT],
  };

  if (!allowed[current].includes(next)) {
    throw new ForbiddenError({
      key: "invalidStatusTransition",
      params: { from: current, to: next },
    });
  }
}

export async function publishProduct(ctx: RequestContext, productId: string) {
  requirePermission(ctx, "product:update");

  const repo = productRepository(ctx);
  const product = await repo.getById(productId);

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  assertStatusTransition(product.status, ProductStatus.PUBLISHED);
  assertCanPublish(product);

  return repo.update(productId, product.version, {
    status: ProductStatus.PUBLISHED,
  });
}

export async function unpublishProduct(ctx: RequestContext, productId: string) {
  requirePermission(ctx, "product:update");

  const repo = productRepository(ctx);
  const product = await repo.getById(productId);

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  assertStatusTransition(product.status, ProductStatus.DRAFT);

  return repo.update(productId, product.version, {
    status: ProductStatus.DRAFT,
  });
}

export async function archiveProduct(ctx: RequestContext, productId: string) {
  requirePermission(ctx, "product:update");

  const repo = productRepository(ctx);
  const product = await repo.getById(productId);

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  assertStatusTransition(product.status, ProductStatus.ARCHIVED);

  return repo.update(productId, product.version, {
    status: ProductStatus.ARCHIVED,
  });
}

export async function unarchiveProduct(ctx: RequestContext, productId: string) {
  requirePermission(ctx, "product:update");

  const repo = productRepository(ctx);
  const product = await repo.getById(productId);

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  assertStatusTransition(product.status, ProductStatus.DRAFT);

  return repo.update(productId, product.version, {
    status: ProductStatus.DRAFT,
  });
}
