"use server";

import { getServerZodErrorMap } from "@/i18n/serverZodErrorMap";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createTagSchema, updateTagSchema, CreateTagInput, UpdateTagInput } from "../schema/tags";
import { createTag, updateTag, deleteTag, duplicateTag } from "../db/tags";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { requireRole } from "@/lib/auth/requireRole";
import { recordAudit } from "@/features/audit/db/audit";
import { ActionErrorResult } from "@/types/types";

// Server-action callers pass unlocalized paths like "/admin/tags"; we
// re-prefix with the caller's request locale so the post-redirect URL stays
// in the same language and middleware doesn't have to bounce again.
async function localizedRedirect(redirectTo: string): Promise<never> {
  const locale = await getLocale();
  redirect(`/${locale}${redirectTo}`);
}

export async function createTagAction(
  unsafeData: CreateTagInput,
  redirectTo = "/admin/tags",
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");

    const parsed = createTagSchema.safeParse(unsafeData, { error: await getServerZodErrorMap() });
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }

    const created = await createTag({
      name: parsed.data.name,
      slug: parsed.data.slug || undefined,
      translations: parsed.data.translations ?? null,
    });
    await recordAudit({ action: "tag.created", entityType: "Tag", entityId: created.id });
  } catch (error) {
    return handleActionError(error);
  }

  await localizedRedirect(redirectTo);
}

export async function updateTagAction(
  id: string,
  unsafeData: UpdateTagInput,
  redirectTo = "/admin/tags",
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");

    const parsed = updateTagSchema.safeParse(unsafeData, { error: await getServerZodErrorMap() });
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }

    await updateTag(id, {
      name: parsed.data.name,
      slug: parsed.data.slug || undefined,
      translations: parsed.data.translations ?? null,
    });
    await recordAudit({ action: "tag.updated", entityType: "Tag", entityId: id });
  } catch (error) {
    return handleActionError(error);
  }

  await localizedRedirect(redirectTo);
}

export async function deleteTagAction(
  id: string,
  redirectTo = "/admin/tags",
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    await deleteTag(id);
    await recordAudit({ action: "tag.deleted", entityType: "Tag", entityId: id });
  } catch (error) {
    return handleActionError(error);
  }

  await localizedRedirect(redirectTo);
}

export async function duplicateTagAction(
  id: string,
): Promise<{ error: false; id: string } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const copy = await duplicateTag(id);
    await recordAudit({ action: "tag.duplicated", entityType: "Tag", entityId: copy.id, diff: { from: id } });
    return { error: false, id: copy.id };
  } catch (error) {
    return handleActionError(error);
  }
}
