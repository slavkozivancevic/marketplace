"use server";

import { getServerZodErrorMap } from "@/i18n/serverZodErrorMap";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { couponSchema, type CouponInput } from "../schema/coupons";
import {
  createCoupon,
  updateCoupon,
  deleteCoupon,
  duplicateCoupon,
  isCouponCodeTaken,
} from "../db/coupons";
import { handleActionError, ForbiddenError } from "@/features/common/errors/domainErrors";
import { requireRole } from "@/lib/auth/requireRole";
import { recordAudit } from "@/features/audit/db/audit";
import { decimalToCents } from "@/lib/currency";
import { CouponType } from "@/generated/prisma/client";
import type { ActionErrorResult } from "@/types/types";

async function localizedRedirect(path: string): Promise<never> {
  const locale = await getLocale();
  redirect(`/${locale}${path}`);
}

/** Drop the cached coupon list + edit pages so fresh data shows after a mutation
 *  (the client Router Cache would otherwise serve stale form values). */
function revalidateCoupons() {
  revalidatePath("/[locale]/admin/coupons", "page");
  revalidatePath("/[locale]/admin/coupons/[id]/edit", "page");
}

/** Maps the form input to stored columns: FIXED `value` and `minOrder` are
 *  entered in dollars and stored as USD base cents; PERCENT `value` is the raw
 *  percent. */
function toMutationData(data: CouponInput) {
  return {
    code: data.code,
    type: data.type as CouponType,
    value: data.type === "FIXED" ? decimalToCents(data.value) : Math.round(data.value),
    minOrder: data.minOrder != null ? decimalToCents(data.minOrder) : null,
    usageLimit: data.usageLimit ?? null,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    active: data.active,
  };
}

export async function createCouponAction(
  unsafe: CouponInput,
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const parsed = couponSchema.safeParse(unsafe, { error: await getServerZodErrorMap() });
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }
    if (await isCouponCodeTaken(parsed.data.code)) {
      throw new ForbiddenError({ key: "couponCodeTaken" });
    }
    const created = await createCoupon(toMutationData(parsed.data));
    await recordAudit({ action: "coupon.created", entityType: "Coupon", entityId: created.id });
    revalidateCoupons();
  } catch (error) {
    return handleActionError(error);
  }
  await localizedRedirect("/admin/coupons");
}

export async function updateCouponAction(
  id: string,
  unsafe: CouponInput,
): Promise<void | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const parsed = couponSchema.safeParse(unsafe, { error: await getServerZodErrorMap() });
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }
    if (await isCouponCodeTaken(parsed.data.code, id)) {
      throw new ForbiddenError({ key: "couponCodeTaken" });
    }
    await updateCoupon(id, toMutationData(parsed.data));
    await recordAudit({ action: "coupon.updated", entityType: "Coupon", entityId: id });
    revalidateCoupons();
  } catch (error) {
    return handleActionError(error);
  }
  await localizedRedirect("/admin/coupons");
}

// Delete is an inline row action (not a form submit), so it returns a result
// for the client to react to and refresh - it must NOT redirect.
export async function deleteCouponAction(
  id: string,
): Promise<{ ok: true } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    await deleteCoupon(id);
    await recordAudit({ action: "coupon.deleted", entityType: "Coupon", entityId: id });
    revalidateCoupons();
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}

export async function duplicateCouponAction(
  id: string,
): Promise<{ ok: true; id: string } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const copy = await duplicateCoupon(id);
    await recordAudit({ action: "coupon.created", entityType: "Coupon", entityId: copy.id, diff: { from: copy.sourceCode } });
    revalidateCoupons();
    return { ok: true, id: copy.id };
  } catch (error) {
    return handleActionError(error);
  }
}
