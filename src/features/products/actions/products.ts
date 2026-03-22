"use server";

import { redirect } from "next/navigation";
import {
  createProductSchema,
  updateProductSchema,
  CreateProductInput,
  UpdateProductInput,
} from "../schema/products";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { ProductHistory, ProductStatus } from "@/generated/prisma/client";
import { ProductRepo, productRepository } from "../db/products";
import {
  ActionErrorResult,
  ProductListItem,
  ProductWithRelations,
} from "@/types/types";
import { requirePermission } from "@/lib/auth/permissions";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";

// READ
export async function getProducts(
  repo: ProductRepo,
): Promise<
  { products: ProductListItem[]; nextCursor?: string } | ActionErrorResult
> {
  // "use cache";
  try {
    // const ctx = await resolveRequestContext();
    // requirePermission(ctx, "product:read");
    // cacheTag(getProductGlobalTag(ctx.organizationId));
    // const repo = productRepository(ctx);

    return await repo.getAll();
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getProductById(
  repo: ProductRepo,
  id: string,
): Promise<ProductWithRelations | null | ActionErrorResult> {
  try {
    // const ctx = await resolveRequestContext();
    // requirePermission(ctx, "product:read");
    // const repo = productRepository(ctx);

    return await repo.getById(id);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function getProductHistory(
  repo: ProductRepo,
  productId: string,
): Promise<ProductHistory[] | ActionErrorResult> {
  try {
    // const ctx = await resolveRequestContext();
    // requirePermission(ctx, "product:read");
    // const repo = productRepository(ctx);

    return await repo.getHistory(productId);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function previewProductVersion(
  repo: ProductRepo,
  productId: string,
  version: number,
): Promise<ProductHistory | ActionErrorResult> {
  try {
    // const ctx = await resolveRequestContext();
    // requirePermission(ctx, "product:read");
    // const repo = productRepository(ctx);

    return await repo.previewVersion(productId, version);
  } catch (error) {
    return handleActionError(error);
  }
}

// WRITE

export async function createProduct(
  // repo: ProductRepo,
  unsafeData: CreateProductInput,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = createProductSchema.safeParse(unsafeData);

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((issue) => issue.message).join(", "),
      };
    }

    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:create");
    const repo = productRepository(ctx);

    await repo.create(parsed.data);

    redirect("/admin/products");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateProduct(
  // repo: ProductRepo,
  id: string,
  unsafeData: UpdateProductInput,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = updateProductSchema.safeParse(unsafeData);

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((issue) => issue.message).join(", "),
      };
    }

    const { version, ...data } = parsed.data;

    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");
    const repo = productRepository(ctx);

    await repo.update(id, version, data);

    redirect("/admin/products");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteProduct(
  // repo: ProductRepo,
  id: string,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:delete");
    const repo = productRepository(ctx);

    await repo.delete(id);

    redirect("/admin/products");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function rollbackProductVersion(
  // repo: ProductRepo,
  productId: string,
  targetVersion: number,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");
    const repo = productRepository(ctx);

    await repo.rollbackToVersion(productId, targetVersion);

    redirect(`/admin/products/${productId}/history`);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function publishProduct(
  // repo: ProductRepo,
  productId: string,
  version: number,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");
    const repo = productRepository(ctx);

    await repo.update(productId, version, {
      status: ProductStatus.PUBLISHED,
    });

    redirect("/admin/products");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function unpublishProduct(
  // repo: ProductRepo,
  productId: string,
  version: number,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");
    const repo = productRepository(ctx);

    await repo.update(productId, version, {
      status: ProductStatus.DRAFT,
    });

    redirect("/admin/products");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function archiveProduct(
  // repo: ProductRepo,
  productId: string,
  version: number,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");
    const repo = productRepository(ctx);

    await repo.update(productId, version, {
      status: ProductStatus.ARCHIVED,
    });

    redirect("/admin/products");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function bulkUpdateProductStatus(
  // repo: ProductRepo,
  productIds: string[],
  status: ProductStatus,
): Promise<{ error: false; message: string } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");
    const repo = productRepository(ctx);

    await repo.bulkUpdateStatus(productIds, status);

    return {
      error: false,
      message: `Updated ${productIds.length} product(s).`,
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function bulkDeleteProducts(
  // repo: ProductRepo,
  productIds: string[],
): Promise<{ error: false; message: string } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:delete");
    const repo = productRepository(ctx);

    await repo.bulkDelete(productIds);

    return {
      error: false,
      message: `Deleted ${productIds.length} product(s).`,
    };
  } catch (error) {
    return handleActionError(error);
  }
}
