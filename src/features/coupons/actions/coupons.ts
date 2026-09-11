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
  getCouponById,
} from "../db/coupons";
import { handleActionError, ForbiddenError } from "@/features/common/errors/domainErrors";
import { requireRole } from "@/lib/auth/requireRole";
import { recordAudit } from "@/features/audit/db/audit";
import { moneyUsdCents, parseMoney, type MoneySet } from "@/lib/money";
import { buildMoneySet, preserveDerived } from "@/lib/money-input";
import { getCurrencyRates } from "@/features/currency/db/currencyRates";
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

/**
 * Maps the form input to stored columns.
 *
 * A PERCENT coupon has no money in it: `value` stays the raw percent and
 * `valueMoney` is null. Scaling a percent as if it were an amount is the exact
 * mistake the schema comment on Coupon.value warns about.
 *
 * A FIXED coupon stores the exact per-currency discount in `valueMoney`, with
 * `value` as the USD-cent mirror that the subtotal comparison uses.
 *
 * Rates are read here rather than trusted from the request.
 */
async function toMutationData(data: CouponInput, existingId?: string) {
  const rates = await getCurrencyRates();
  const isFixed = data.type === "FIXED";
  // On an edit, an amount the user did not touch keeps the derived currencies it
  // already had - renaming a coupon must not re-price the discount a German
  // buyer gets. Absent on create, where there is nothing to preserve.
  const stored = existingId ? await getCouponById(existingId) : null;
  const keep = (built: MoneySet | null, was: unknown) =>
    built ? preserveDerived(built, parseMoney(was)) : null;

  const amount = keep(isFixed ? buildMoneySet(data.amount, rates) : null, stored?.valueMoney);
  const minOrder = keep(
    data.minOrder != null ? buildMoneySet(data.minOrder, rates) : null,
    stored?.minOrderMoney,
  );

  return {
    code: data.code,
    type: data.type as CouponType,
    value: amount ? moneyUsdCents(amount) : Math.round(data.percent),
    valueMoney: amount,
    minOrder: minOrder ? moneyUsdCents(minOrder) : null,
    minOrderMoney: minOrder,
    usageLimit: data.usageLimit ?? null,
    perUserLimit: data.perUserLimit ?? null,
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
    const created = await createCoupon(await toMutationData(parsed.data));
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
    await updateCoupon(id, await toMutationData(parsed.data, id));
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
