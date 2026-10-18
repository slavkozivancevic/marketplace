"use server";

import { getServerZodErrorMap } from "@/i18n/serverZodErrorMap";
import {
  createTrustPointSchema,
  updateTrustPointSchema,
  type CreateTrustPointInput,
  type UpdateTrustPointInput,
} from "../schema/trustPoints";
import {
  createTrustPoint,
  updateTrustPoint,
  deleteTrustPoint,
  duplicateTrustPoint,
} from "../db/trustPoints";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { requireRole } from "@/lib/auth/requireRole";
import { recordAudit } from "@/features/audit/db/audit";
import { ActionErrorResult } from "@/types/types";

// Every action hands its redirect target back to the caller instead of
// redirecting: `redirect()` unwinds by throwing, so the form never got to
// confirm the save or drop its dirty state - it simply vanished to the list
// with nothing said. The client re-prefixes with the request locale.

export async function createTrustPointAction(
  unsafeData: CreateTrustPointInput,
  redirectTo = "/admin/trust-points",
): Promise<{ ok: true; redirectTo: string } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");

    const parsed = createTrustPointSchema.safeParse(unsafeData, {
      error: await getServerZodErrorMap(),
    });
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }

    const created = await createTrustPoint({
      ...parsed.data,
      translations: parsed.data.translations ?? null,
    });
    await recordAudit({
      action: "trust_point.created",
      entityType: "TrustPoint",
      entityId: created.id,
      diff: { name: parsed.data.label },
    });
    return { ok: true, redirectTo };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateTrustPointAction(
  id: string,
  unsafeData: UpdateTrustPointInput,
  redirectTo = "/admin/trust-points",
): Promise<{ ok: true; redirectTo: string } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");

    const parsed = updateTrustPointSchema.safeParse(unsafeData, {
      error: await getServerZodErrorMap(),
    });
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }

    await updateTrustPoint(id, {
      ...parsed.data,
      translations: parsed.data.translations ?? null,
    });
    await recordAudit({
      action: "trust_point.updated",
      entityType: "TrustPoint",
      entityId: id,
      diff: { name: parsed.data.label, isActive: parsed.data.isActive },
    });
    return { ok: true, redirectTo };
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Duplicates a trust point and returns the copy's id, so the list can offer
 * "Edit copy" in its toast. Mirrors `duplicateTagAction`.
 *
 * The audit line carries the SOURCE's label, not its id: "Copied from: Secure
 * payment" is a sentence a reader can act on, a UUID is not.
 */
export async function duplicateTrustPointAction(
  id: string,
): Promise<{ error: false; id: string } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const copy = await duplicateTrustPoint(id);
    await recordAudit({
      action: "trust_point.duplicated",
      entityType: "TrustPoint",
      entityId: copy.id,
      diff: { from: copy.sourceLabel, fromId: id },
    });
    return { error: false, id: copy.id };
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Returns instead of redirecting. The only caller is the admin list - the very
 * page a redirect would have pointed at - so navigating bought nothing and cost
 * the confirmation toast, which `redirect()`'s thrown unwind made unreachable.
 */
export async function deleteTrustPointAction(
  id: string,
): Promise<{ ok: true } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const name = await deleteTrustPoint(id);
    await recordAudit({
      action: "trust_point.deleted",
      entityType: "TrustPoint",
      entityId: id,
      diff: { name },
    });
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}
