"use server";

import { getServerZodErrorMap } from "@/i18n/serverZodErrorMap";
import { createTagSchema, updateTagSchema, CreateTagInput, UpdateTagInput } from "../schema/tags";
import { createTag, updateTag, deleteTag, duplicateTag } from "../db/tags";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { requireRole } from "@/lib/auth/requireRole";
import { recordAudit } from "@/features/audit/db/audit";
import { ActionErrorResult } from "@/types/types";

// Every action here hands its redirect target back to the caller instead of
// redirecting, so there is no server-side navigation left to localize. The
// client re-prefixes with the request locale.

/**
 * Hands the redirect target back instead of performing it. `redirect()` unwinds
 * by throwing, so the form never got to confirm the save or drop its dirty
 * state - it simply vanished to the list with nothing said.
 */
export async function createTagAction(
  unsafeData: CreateTagInput,
  redirectTo = "/admin/tags",
): Promise<{ ok: true; redirectTo: string } | ActionErrorResult> {
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
    return { ok: true, redirectTo };
  } catch (error) {
    return handleActionError(error);
  }
}

/** Hands the redirect target back instead of performing it - see createTagAction. */
export async function updateTagAction(
  id: string,
  unsafeData: UpdateTagInput,
  redirectTo = "/admin/tags",
): Promise<{ ok: true; redirectTo: string } | ActionErrorResult> {
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
    return { ok: true, redirectTo };
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Returns instead of redirecting. `redirect()` unwinds by throwing, so an action
 * that ends in one never returns to its caller - and everything the caller had
 * queued after the await (the success toast, clearing the row's spinner) was
 * silently unreachable. The only caller is the admin list, the very page the
 * redirect pointed at, so the navigation bought nothing and cost the
 * confirmation. `deleteTag` revalidates the cache; the caller refreshes.
 */
export async function deleteTagAction(
  id: string,
): Promise<{ ok: true } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const name = await deleteTag(id);
    await recordAudit({
      action: "tag.deleted",
      entityType: "Tag",
      entityId: id,
      diff: { name },
    });
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function duplicateTagAction(
  id: string,
): Promise<{ error: false; id: string } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const copy = await duplicateTag(id);
    await recordAudit({
      action: "tag.duplicated",
      entityType: "Tag",
      entityId: copy.id,
      diff: { from: copy.sourceLabel, fromId: id },
    });
    return { error: false, id: copy.id };
  } catch (error) {
    return handleActionError(error);
  }
}
