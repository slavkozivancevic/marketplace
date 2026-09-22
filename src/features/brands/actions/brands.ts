"use server";

import { getServerZodErrorMap } from "@/i18n/serverZodErrorMap";
import { createBrandSchema, updateBrandSchema, CreateBrandInput, UpdateBrandInput } from "../schema/brands";
import { createBrand, updateBrand, deleteBrand, duplicateBrand } from "../db/brands";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { requireRole } from "@/lib/auth/requireRole";
import { recordAudit } from "@/features/audit/db/audit";
import { ActionErrorResult } from "@/types/types";

// Every action here hands its redirect target back to the caller instead of
// redirecting, so there is no server-side navigation left to localize. The
// client re-prefixes with the request locale.

export async function createBrandAction(
  unsafeData: CreateBrandInput,
  redirectTo = "/admin/brands",
): Promise<{ ok: true; redirectTo: string } | ActionErrorResult> {
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
    return { ok: true, redirectTo: redirectTo };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateBrandAction(
  id: string,
  unsafeData: UpdateBrandInput,
  redirectTo = "/admin/brands",
): Promise<{ ok: true; redirectTo: string } | ActionErrorResult> {
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
    return { ok: true, redirectTo: redirectTo };
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Returns instead of redirecting - see the note on deleteTagAction. The redirect
 * threw past the caller's success toast and spinner reset, and pointed at the
 * admin list the caller was already on.
 */
export async function deleteBrandAction(
  id: string,
): Promise<{ ok: true } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const name = await deleteBrand(id);
    await recordAudit({
      action: "brand.deleted",
      entityType: "Brand",
      entityId: id,
      diff: { name },
    });
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function duplicateBrandAction(
  id: string,
): Promise<{ error: false; id: string } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const copy = await duplicateBrand(id);
    await recordAudit({
      action: "brand.duplicated",
      entityType: "Brand",
      entityId: copy.id,
      diff: { from: copy.sourceLabel, fromId: id },
    });
    return { error: false, id: copy.id };
  } catch (error) {
    return handleActionError(error);
  }
}