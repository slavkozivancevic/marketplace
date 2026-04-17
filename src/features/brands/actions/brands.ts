"use server";

import { redirect } from "next/navigation";
import { createBrandSchema, updateBrandSchema, CreateBrandInput, UpdateBrandInput } from "../schema/brands";
import { createBrand, updateBrand, deleteBrand } from "../db/brands";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { requireRole } from "@/lib/auth/requireRole";
import { ActionErrorResult } from "@/types/types";

export async function createBrandAction(
  unsafeData: CreateBrandInput,
  redirectTo = "/admin/brands",
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");

    const parsed = createBrandSchema.safeParse(unsafeData);
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }

    await createBrand({
      name: parsed.data.name,
      slug: parsed.data.slug || undefined,
      logoUrl: parsed.data.logoUrl || null,
      description: parsed.data.description || null,
    });
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
}

export async function updateBrandAction(
  id: string,
  unsafeData: UpdateBrandInput,
  redirectTo = "/admin/brands",
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");

    const parsed = updateBrandSchema.safeParse(unsafeData);
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }

    await updateBrand(id, {
      name: parsed.data.name,
      slug: parsed.data.slug || undefined,
      logoUrl: parsed.data.logoUrl || null,
      description: parsed.data.description || null,
    });
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
}

export async function deleteBrandAction(
  id: string,
  redirectTo = "/admin/brands",
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    await deleteBrand(id);
  } catch (error) {
    return handleActionError(error);
  }

  redirect(redirectTo);
}