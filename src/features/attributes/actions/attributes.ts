"use server";

import { getServerZodErrorMap } from "@/i18n/serverZodErrorMap";
import { attributeSchema, type AttributeInput } from "../schema/attributes";
import {
  createAttribute,
  updateAttribute,
  deleteAttribute,
  duplicateAttribute,
} from "../db/attributes";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { requireRole } from "@/lib/auth/requireRole";
import { recordAudit } from "@/features/audit/db/audit";
import type { ActionErrorResult } from "@/types/types";

// Every action here hands its redirect target back to the caller instead of
// redirecting, so there is no server-side navigation left to localize.

export async function createAttributeAction(
  unsafeData: AttributeInput,
): Promise<{ ok: true; redirectTo: string } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const parsed = attributeSchema.safeParse(unsafeData, { error: await getServerZodErrorMap() });
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }
    const created = await createAttribute(parsed.data);
    await recordAudit({ action: "attribute.created", entityType: "Attribute", entityId: created.id });
    return { ok: true, redirectTo: "/admin/attributes" };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateAttributeAction(
  id: string,
  unsafeData: AttributeInput,
): Promise<{ ok: true; redirectTo: string } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const parsed = attributeSchema.safeParse(unsafeData, { error: await getServerZodErrorMap() });
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }
    await updateAttribute(id, parsed.data);
    await recordAudit({ action: "attribute.updated", entityType: "Attribute", entityId: id });
    return { ok: true, redirectTo: "/admin/attributes" };
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Returns instead of redirecting - see the note on deleteTagAction. The redirect
 * threw past the caller's success toast and spinner reset, and pointed at the
 * admin list the caller was already on.
 */
export async function deleteAttributeAction(
  id: string,
): Promise<{ ok: true } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const key = await deleteAttribute(id);
    await recordAudit({
      action: "attribute.deleted",
      entityType: "Attribute",
      entityId: id,
      diff: { name: key },
    });
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function duplicateAttributeAction(
  id: string,
): Promise<{ error: false; id: string } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const copy = await duplicateAttribute(id);
    await recordAudit({
      action: "attribute.duplicated",
      entityType: "Attribute",
      entityId: copy.id,
      diff: { from: copy.sourceLabel, fromId: id },
    });
    return { error: false, id: copy.id };
  } catch (error) {
    return handleActionError(error);
  }
}
