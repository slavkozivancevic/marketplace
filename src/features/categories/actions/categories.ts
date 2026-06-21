"use server";

import { getServerZodErrorMap } from "@/i18n/serverZodErrorMap";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { categorySchema, type CategoryInput } from "../schema/categories";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  duplicateCategory,
} from "../db/categories";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { requireRole } from "@/lib/auth/requireRole";
import { recordAudit } from "@/features/audit/db/audit";
import type { ActionErrorResult } from "@/types/types";

async function localizedRedirect(redirectTo: string): Promise<never> {
  const locale = await getLocale();
  redirect(`/${locale}${redirectTo}`);
}

export async function createCategoryAction(
  unsafeData: CategoryInput,
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");

    const parsed = categorySchema.safeParse(unsafeData, { error: await getServerZodErrorMap() });
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const { slug, imageUrl, description, parentId, translations, ...rest } = parsed.data;
    const created = await createCategory({
      ...rest,
      slug: slug || undefined,
      imageUrl: imageUrl || null,
      description: description || null,
      parentId: parentId || null,
      translations: translations ?? null,
    });
    await recordAudit({ action: "category.created", entityType: "Category", entityId: created.id });
  } catch (error) {
    return handleActionError(error);
  }

  await localizedRedirect("/admin/categories");
}

export async function updateCategoryAction(
  id: string,
  unsafeData: CategoryInput,
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");

    const parsed = categorySchema.safeParse(unsafeData, { error: await getServerZodErrorMap() });
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
    await recordAudit({ action: "category.updated", entityType: "Category", entityId: id });
  } catch (error) {
    return handleActionError(error);
  }

  await localizedRedirect("/admin/categories");
}

export async function deleteCategoryAction(
  id: string,
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    await deleteCategory(id);
    await recordAudit({ action: "category.deleted", entityType: "Category", entityId: id });
  } catch (error) {
    return handleActionError(error);
  }

  await localizedRedirect("/admin/categories");
}

export async function duplicateCategoryAction(
  id: string,
): Promise<{ error: false; id: string } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const copy = await duplicateCategory(id);
    await recordAudit({ action: "category.duplicated", entityType: "Category", entityId: copy.id, diff: { from: id } });
    return { error: false, id: copy.id };
  } catch (error) {
    return handleActionError(error);
  }
}