"use server";

import { redirect } from "next/navigation";
import {
  createProductSchema,
  updateProductSchema,
  CreateProductInput,
  UpdateProductInput,
} from "../schema/products";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { ProductStatus } from "@/generated/prisma/client";
import { productRepository } from "../db/products";
import { ActionErrorResult } from "@/types/types";
import { requirePermission } from "@/lib/auth/permissions";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";

// WRITE

export async function createProduct(
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
  } catch (error) {
    return handleActionError(error);
  }

  redirect("/admin/products");
}

export async function updateProduct(
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
  } catch (error) {
    return handleActionError(error);
  }

  redirect(`/admin/products/${id}`);
}

export async function deleteProduct(
  id: string,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:delete");
    const repo = productRepository(ctx);

    await repo.delete(id);
  } catch (error) {
    return handleActionError(error);
  }

  redirect("/admin/products");
}

export async function rollbackProductVersion(
  productId: string,
  targetVersion: number,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");
    const repo = productRepository(ctx);

    await repo.rollbackToVersion(productId, targetVersion);
  } catch (error) {
    return handleActionError(error);
  }

  redirect(`/admin/products/${productId}/history`);
}

export async function publishProduct(
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
  } catch (error) {
    return handleActionError(error);
  }

  redirect("/admin/products");
}

export async function unpublishProduct(
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
  } catch (error) {
    return handleActionError(error);
  }

  redirect("/admin/products");
}

export async function archiveProduct(
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
  } catch (error) {
    return handleActionError(error);
  }

  redirect("/admin/products");
}

export async function bulkUpdateProductStatus(
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

// // READ
// export async function getProducts(
//   repo: ProductRepo,
// ): Promise<
//   { products: ProductListItem[]; nextCursor?: string } | ActionErrorResult
// > {
//   // "use cache";
//   try {
//     // const ctx = await resolveRequestContext();
//     // requirePermission(ctx, "product:read");
//     // cacheTag(getProductGlobalTag(ctx.organizationId));
//     // const repo = productRepository(ctx);

//     return await repo.getAll();
//   } catch (error) {
//     return handleActionError(error);
//   }
// }

// export async function getProductById(
//   repo: ProductRepo,
//   id: string,
// ): Promise<ProductWithRelations | null | ActionErrorResult> {
//   try {
//     // const ctx = await resolveRequestContext();
//     // requirePermission(ctx, "product:read");
//     // const repo = productRepository(ctx);

//     return await repo.getById(id);
//   } catch (error) {
//     return handleActionError(error);
//   }
// }

// export async function getProductHistory(
//   repo: ProductRepo,
//   productId: string,
// ): Promise<ProductHistory[] | ActionErrorResult> {
//   try {
//     // const ctx = await resolveRequestContext();
//     // requirePermission(ctx, "product:read");
//     // const repo = productRepository(ctx);

//     return await repo.getHistory(productId);
//   } catch (error) {
//     return handleActionError(error);
//   }
// }

// export async function previewProductVersion(
//   repo: ProductRepo,
//   productId: string,
//   version: number,
// ): Promise<ProductHistory | ActionErrorResult> {
//   try {
//     // const ctx = await resolveRequestContext();
//     // requirePermission(ctx, "product:read");
//     // const repo = productRepository(ctx);

//     return await repo.previewVersion(productId, version);
//   } catch (error) {
//     return handleActionError(error);
//   }
// }
