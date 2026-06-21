"use server";

import { getServerZodErrorMap } from "@/i18n/serverZodErrorMap";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createBrandSchema, updateBrandSchema, CreateBrandInput, UpdateBrandInput } from "../schema/brands";
import { createBrand, updateBrand, deleteBrand, duplicateBrand } from "../db/brands";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { requireRole } from "@/lib/auth/requireRole";
import { recordAudit } from "@/features/audit/db/audit";
import { ActionErrorResult } from "@/types/types";

// Server-action callers pass unlocalized paths like "/admin/brands"; we
// re-prefix with the caller's request locale so the post-redirect URL stays
// in the same language and middleware doesn't have to bounce again.
async function localizedRedirect(redirectTo: string): Promise<never> {
  const locale = await getLocale();
  redirect(`/${locale}${redirectTo}`);
}

export async function createBrandAction(
  unsafeData: CreateBrandInput,
  redirectTo = "/admin/brands",
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");

    const parsed = createBrandSchema.safeParse(unsafeData, { error: await getServerZodErrorMap() });
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }

    const created = await createBrand({
      name: parsed.data.name,
      slug: parsed.data.slug || undefined,
      logoUrl: parsed.data.logoUrl || null,
      logoUrlDark: parsed.data.logoUrlDark || null,
      logoBackdrop: parsed.data.logoBackdrop ?? "AUTO",
      logoBackdropDark: parsed.data.logoBackdropDark ?? "AUTO",
      description: parsed.data.description || null,
      translations: parsed.data.translations ?? null,
    });
    await recordAudit({ action: "brand.created", entityType: "Brand", entityId: created.id });
  } catch (error) {
    return handleActionError(error);
  }

  await localizedRedirect(redirectTo);
}

export async function updateBrandAction(
  id: string,
  unsafeData: UpdateBrandInput,
  redirectTo = "/admin/brands",
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");

    const parsed = updateBrandSchema.safeParse(unsafeData, { error: await getServerZodErrorMap() });
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }

    await updateBrand(id, {
      name: parsed.data.name,
      slug: parsed.data.slug || undefined,
      logoUrl: parsed.data.logoUrl || null,
      logoUrlDark: parsed.data.logoUrlDark || null,
      logoBackdrop: parsed.data.logoBackdrop ?? "AUTO",
      logoBackdropDark: parsed.data.logoBackdropDark ?? "AUTO",
      description: parsed.data.description || null,
      translations: parsed.data.translations ?? null,
    });
    await recordAudit({ action: "brand.updated", entityType: "Brand", entityId: id });
  } catch (error) {
    return handleActionError(error);
  }

  await localizedRedirect(redirectTo);
}

export async function deleteBrandAction(
  id: string,
  redirectTo = "/admin/brands",
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    await deleteBrand(id);
    await recordAudit({ action: "brand.deleted", entityType: "Brand", entityId: id });
  } catch (error) {
    return handleActionError(error);
  }

  await localizedRedirect(redirectTo);
}

export async function duplicateBrandAction(
  id: string,
): Promise<{ error: false; id: string } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const copy = await duplicateBrand(id);
    await recordAudit({ action: "brand.duplicated", entityType: "Brand", entityId: copy.id, diff: { from: id } });
    return { error: false, id: copy.id };
  } catch (error) {
    return handleActionError(error);
  }
}