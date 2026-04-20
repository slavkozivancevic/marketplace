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
import type { BulkFilter, BulkUpdateFields } from "../types/bulk";
import { requirePermission } from "@/lib/auth/permissions";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import {
  publishProduct as workflowPublish,
  unpublishProduct as workflowUnpublish,
  archiveProduct as workflowArchive,
  unarchiveProduct as workflowUnarchive,
} from "../services/productWorkflow";

/** Shape of a single row from the CSV import. */
export type BulkCreateRow = {
  title: string;
  description: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  stock?: number;
  barcode?: string;
  taxable?: boolean;
  requiresShipping?: boolean;
  isDigital?: boolean;
  weight?: number;
  weightUnit?: string;
  brandId?: string;
  metaTitle?: string;
  metaDescription?: string;
  status?: ProductStatus;
};

export type BulkCreateResult = {
  totalRows: number;
  created: number;
  errors: { row: number; message: string }[];
};

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

export async function unarchiveProduct(
  productId: string,
  redirectTo = `/admin/products/${productId}`,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    await workflowUnarchive(ctx, productId);
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

export async function duplicateProduct(
  id: string,
): Promise<{ error: false; id: string; message: string } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    // Duplicate requires both read (to fetch) and create (to insert the copy).
    requirePermission(ctx, "product:read");
    requirePermission(ctx, "product:create");
    const repo = productRepository(ctx);

    const copy = await repo.duplicate(id);

    return { error: false, id: copy.id, message: "Product duplicated." };
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Bulk-create products from pre-parsed CSV rows.
 * Processes each row independently and reports per-row errors without
 * aborting the entire import.
 */
export async function bulkCreateProducts(
  rows: BulkCreateRow[],
): Promise<{ error: false; result: BulkCreateResult } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:create");
    const repo = productRepository(ctx);

    const result: BulkCreateResult = {
      totalRows: rows.length,
      created: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        await repo.create({
          title: row.title,
          description: row.description,
          shortDescription: row.shortDescription,
          price: row.price,
          compareAtPrice: row.compareAtPrice ?? null,
          costPrice: row.costPrice ?? null,
          stock: row.stock ?? null,
          barcode: row.barcode,
          taxable: row.taxable ?? true,
          requiresShipping: row.requiresShipping ?? true,
          isDigital: row.isDigital ?? false,
          weight: row.weight ?? null,
          weightUnit: row.weightUnit ?? null,
          brandId: row.brandId,
          metaTitle: row.metaTitle,
          metaDescription: row.metaDescription,
        });
        result.created++;
      } catch (err) {
        result.errors.push({
          row: i + 1,
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return { error: false, result };
  } catch (error) {
    return handleActionError(error);
  }
}

export type PreviewResult = {
  count: number;
  samples: {
    id: string;
    title: string;
    price: number;
    status: string;
    brand: { name: string } | null;
  }[];
};

export async function previewBulkFilter(
  filter: BulkFilter,
): Promise<{ error: false; data: PreviewResult } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:read");
    const repo = productRepository(ctx);
    const data = await repo.previewByFilter(filter);
    return { error: false, data };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function bulkDeleteByFilter(
  filter: BulkFilter,
): Promise<{ error: false; count: number; message: string } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:delete");
    const repo = productRepository(ctx);
    const { count } = await repo.bulkDeleteByFilter(filter);
    return {
      error: false,
      count,
      message: count > 0 ? `Deleted ${count} product(s).` : "No products matched the filter.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function bulkUpdateByFilter(
  filter: BulkFilter,
  updates: BulkUpdateFields,
): Promise<{ error: false; count: number; message: string } | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:update");
    const repo = productRepository(ctx);
    const { count } = await repo.bulkUpdateByFilter(filter, updates);
    return {
      error: false,
      count,
      message: count > 0 ? `Updated ${count} product(s).` : "No products matched the filter.",
    };
  } catch (error) {
    return handleActionError(error);
  }
}
