"use server";

import { redirect } from "next/navigation";
import { categorySchema, type CategoryInput } from "../schema/categories";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "../db/categories";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { requireRole } from "@/lib/auth/requireRole";
import type { ActionErrorResult } from "@/types/types";

export async function createCategoryAction(
  unsafeData: CategoryInput,
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");

    const parsed = categorySchema.safeParse(unsafeData);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const { slug, imageUrl, description, parentId, translations, ...rest } = parsed.data;
    await createCategory({
      ...rest,
      slug: slug || undefined,
      imageUrl: imageUrl || null,
      description: description || null,
      parentId: parentId || null,
      translations: translations ?? null,
    });
  } catch (error) {
    return handleActionError(error);
  }

  redirect("/admin/categories");
}

export async function updateCategoryAction(
  id: string,
  unsafeData: CategoryInput,
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");

    const parsed = categorySchema.safeParse(unsafeData);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const { slug, imageUrl, description, parentId, translations, ...rest } = parsed.data;
    await updateCategory(id, {
      ...rest,
      slug: slug || undefined,
      imageUrl: imageUrl || null,
      description: description || null,
      parentId: parentId ?? null,
      translations: translations ?? null,
    });
  } catch (error) {
    return handleActionError(error);
  }

  redirect("/admin/categories");
}

export async function deleteCategoryAction(
  id: string,
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    await deleteCategory(id);
  } catch (error) {
    return handleActionError(error);
  }

  redirect("/admin/categories");
}