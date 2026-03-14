import { ProductStatus } from "@/generated/prisma/client";
import { RequestContext } from "@/types/types";
import { productRepository } from "../db/products";
import { requirePermission } from "@/lib/auth/permissions";
import {
  ForbiddenError,
  NotFoundError,
} from "@/features/common/errors/domainErrors";

function assertCanPublish(product: {
  title: string;
  description: string;
  price: unknown;
  images?: { key: string }[];
}) {
  if (!product.title.trim()) {
    throw new ForbiddenError("Product title is required before publishing");
  }

  if (!product.description.trim()) {
    throw new ForbiddenError(
      "Product description is required before publishing",
    );
  }

  if (!product.price) {
    throw new ForbiddenError("Product price must be set before publishing");
  }

  if (!product.images || product.images.length === 0) {
    throw new ForbiddenError("At least one product image is required");
  }
}

function assertStatusTransition(current: ProductStatus, next: ProductStatus) {
  if (current === ProductStatus.ARCHIVED) {
    throw new ForbiddenError("Archived products cannot change status");
  }

  const allowed: Record<ProductStatus, ProductStatus[]> = {
    DRAFT: [ProductStatus.PUBLISHED],
    PUBLISHED: [ProductStatus.DRAFT, ProductStatus.ARCHIVED],
    ARCHIVED: [],
  };

  if (!allowed[current].includes(next)) {
    throw new ForbiddenError(
      `Invalid product status transition: ${current} → ${next}`,
    );
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
