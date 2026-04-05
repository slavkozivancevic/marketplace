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
import {
  publishProduct as workflowPublish,
  unpublishProduct as workflowUnpublish,
  archiveProduct as workflowArchive,
} from "../services/productWorkflow";

export async function createProduct(
  unsafeData: CreateProductInput,
  redirectTo = "/admin/products",
): Promise<void | ActionErrorResult> {
  try {
    const parsed = createProductSchema.safeParse(unsafeData);

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:create");
    const repo = productRepository(ctx);

    await repo.create(parsed.data);
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
}

export async function updateProduct(
  id: string,
  unsafeData: UpdateProductInput,
  redirectTo = `/admin/products/${id}`,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = updateProductSchema.safeParse(unsafeData);

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
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

  redirect(redirectTo);
}

export async function deleteProduct(
  id: string,
  redirectTo = "/admin/products",
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:delete");
    const repo = productRepository(ctx);

    await repo.delete(id);
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
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
}

export async function publishProduct(
  productId: string,
  redirectTo = `/admin/products/${productId}`,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    await workflowPublish(ctx, productId);
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
}

export async function unpublishProduct(
  productId: string,
  redirectTo = `/admin/products/${productId}`,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    await workflowUnpublish(ctx, productId);
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
}

export async function archiveProduct(
  productId: string,
  redirectTo = `/admin/products/${productId}`,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    await workflowArchive(ctx, productId);
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
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
