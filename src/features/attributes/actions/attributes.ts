"use server";

import { getServerZodErrorMap } from "@/i18n/serverZodErrorMap";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
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

async function localizedRedirect(redirectTo: string): Promise<never> {
  const locale = await getLocale();
  redirect(`/${locale}${redirectTo}`);
}

export async function createAttributeAction(
  unsafeData: AttributeInput,
): Promise<void | ActionErrorResult> {
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
  } catch (error) {
    return handleActionError(error);
  }
  await localizedRedirect("/admin/attributes");
}

export async function updateAttributeAction(
  id: string,
  unsafeData: AttributeInput,
): Promise<void | ActionErrorResult> {
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
  } catch (error) {
    return handleActionError(error);
  }
  await localizedRedirect("/admin/attributes");
}

export async function deleteAttributeAction(
  id: string,
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    await deleteAttribute(id);
    await recordAudit({ action: "attribute.deleted", entityType: "Attribute", entityId: id });
  } catch (error) {
    return handleActionError(error);
  }
  await localizedRedirect("/admin/attributes");
}

export async function duplicateAttributeAction(
  id: string,
): Promise<{ error: false; id: string } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const copy = await duplicateAttribute(id);
    await recordAudit({ action: "attribute.duplicated", entityType: "Attribute", entityId: copy.id, diff: { from: id } });
    return { error: false, id: copy.id };
  } catch (error) {
    return handleActionError(error);
  }
}
