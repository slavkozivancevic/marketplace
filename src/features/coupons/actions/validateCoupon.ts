"use server";

import { auth } from "@clerk/nextjs/server";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/core/db/prisma";
import { validateCoupon, type CartItemRef } from "../db/coupons";
import { cartSubtotalIn, resolveCart } from "@/features/cart/db/resolveCart";
import { getMoneyContext } from "@/features/currency/db/activeCurrency";
import { formatPrice } from "@/lib/currency";

export type ValidateCouponResult =
  | { ok: true; code: string; discount: number; currency: string }
  | { ok: false; message: string };

/**
 * Cart-side coupon check: recomputes the subtotal from the DB, validates the
 * code and returns the discount in the buyer's display currency. The real
 * redemption is re-validated and applied server-side at checkout.
 */
export async function validateCouponAction(
  code: string,
  items: CartItemRef[],
): Promise<ValidateCouponResult> {
  const t = await getTranslations("coupons");
  const locale = await getLocale();
  if (items.length === 0) return { ok: false, message: t("errors.cartEmpty") };

  const { currency, rates } = await getMoneyContext();

  // Resolve the signed-in buyer (if any) so per-customer limits apply already
  // at the cart check, not only at checkout - the buyer learns immediately.
  const { userId: clerkUserId } = await auth();
  const user = clerkUserId
    ? await prisma.user.findUnique({ where: { clerkUserId }, select: { id: true } })
    : null;

  // Both totals come from one resolution, so the minimum is judged against the
  // exact same cart the buyer is looking at - in their own currency.
  const { lines, subtotalUsd } = await resolveCart(items);
  const subtotal = cartSubtotalIn(lines, currency, rates);

  const res = await validateCoupon(code, subtotalUsd, user?.id, { currency, rates, subtotal });
  if (!res.ok) {
    const message =
      res.reason === "minOrder"
        ? t("errors.minOrder", {
            // Already in the buyer's currency - the same number the comparison
            // used, so the message can never contradict the rejection.
            amount: formatPrice(res.minOrder ?? 0, currency, locale),
          })
        : t(`errors.${res.reason}`);
    return { ok: false, message };
  }

  return { ok: true, code: res.code, discount: res.discount, currency };
}
