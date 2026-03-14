"use server";

import { redirect } from "next/navigation";
import {
  createProductSchema,
  updateProductSchema,
  CreateProductInput,
  UpdateProductInput,
} from "../schema/products";
import { requirePermission } from "@/lib/auth/permissions";
import { productRepository } from "../db/products";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";

export async function createProduct(unsafeData: CreateProductInput) {
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
  id: string,
  unsafeData: UpdateProductInput,
) {
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

export async function deleteProduct(id: string) {
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

export async function getProducts() {
  // "use cache";
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:read");
    // cacheTag(getProductGlobalTag(ctx.organizationId));
    const repo = productRepository(ctx);

    return await repo.getAll();
  } catch (error) {
    return handleActionError(error);
  }
}
