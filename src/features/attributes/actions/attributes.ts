"use server";

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
    const parsed = attributeSchema.safeParse(unsafeData);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }
    await createAttribute(parsed.data);
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
    const parsed = attributeSchema.safeParse(unsafeData);
    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }
    await updateAttribute(id, parsed.data);
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
    return { error: false, id: copy.id };
  } catch (error) {
    return handleActionError(error);
  }
}
