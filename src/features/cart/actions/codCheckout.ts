"use server";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/core/db/prisma";
import { createCodOrder } from "@/features/orders/db/orders";
import { publishCodOrderPlaced } from "@/services/notifications";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { getCurrencyRate } from "@/features/currency/db/currencyRates";
import { convertCents } from "@/lib/currency";
import { validateCoupon } from "@/features/coupons/db/coupons";
import { cartShippingLines } from "@/features/shipping/db/shipping";
import type { ActionErrorResult } from "@/types/types";
import type { CheckoutCartItem } from "./checkout";
import { VALID_CURRENCIES, type Currency } from "@/lib/currency-config";

export type CodShippingInput = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
};

export async function createCodCheckout(
  items: CheckoutCartItem[],
  shipping: CodShippingInput,
  couponCode?: string,
): Promise<{ orderId: string } | ActionErrorResult> {
  try {
    const { userId: clerkUserId } = await auth();
    const cookieStore = await cookies();
    const locale = cookieStore.get("NEXT_LOCALE")?.value ?? "en";
    const rawCurrency = cookieStore.get("NEXT_CURRENCY")?.value ?? "usd";
    const currency: Currency = VALID_CURRENCIES.includes(rawCurrency as Currency)
      ? (rawCurrency as Currency)
      : "usd";
    const t = await getTranslations("actionErrors");

    if (!clerkUserId) {
      return { error: true, message: t("mustBeSignedIn") };
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (!user) return { error: true, message: t("userNotFound") };
    if (items.length === 0) return { error: true, message: t("cartEmpty") };

    // Fetch exchange rate once for the entire order
    const exchangeRate = await getCurrencyRate(currency);

    // Server-side price calculation - never trust client
    const productIds = items.filter((i) => !i.variantId).map((i) => i.productId);
    const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId!);

    const [dbProducts, dbVariants] = await Promise.all([
      productIds.length
        ? prisma.product.findMany({
            where: { id: { in: productIds }, status: "PUBLISHED", deletedAt: null },
            select: { id: true, price: true, stock: true },
          })
        : [],
      variantIds.length
        ? prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, price: true, stock: true },
          })
        : [],
    ]);

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));
    const variantMap = new Map(dbVariants.map((v) => [v.id, v]));

    let totalInCurrency = 0;
    let subtotalUsd = 0;
    for (const item of items) {
      if (item.variantId) {
        const v = variantMap.get(item.variantId);
        if (!v) return { error: true, message: t("itemNoLongerAvailable") };
        if (v.stock < item.quantity) return { error: true, message: t("insufficientStock") };
        subtotalUsd += Number(v.price) * item.quantity;
        const unitCents = convertCents(Number(v.price), currency, exchangeRate);
        totalInCurrency += unitCents * item.quantity;
      } else {
        const p = productMap.get(item.productId);
        if (!p) return { error: true, message: t("itemNoLongerAvailable") };
        if (p.stock !== null && p.stock < item.quantity)
          return { error: true, message: t("insufficientStock") };
        subtotalUsd += Number(p.price) * item.quantity;
        const unitCents = convertCents(Number(p.price), currency, exchangeRate);
        totalInCurrency += unitCents * item.quantity;
      }
    }

    // Coupon: re-validate server-side and subtract the discount from the COD
    // total (the item prices stay at full value, so subtotal - total = discount).
    let appliedCouponId: string | undefined;
    let appliedCouponCode: string | undefined;
    if (couponCode) {
      const res = await validateCoupon(couponCode, subtotalUsd);
      if (res.ok && res.discountUsd > 0) {
        const discountInCurrency = convertCents(res.discountUsd, currency, exchangeRate);
        totalInCurrency = Math.max(0, totalInCurrency - discountInCurrency);
        appliedCouponId = res.couponId;
        appliedCouponCode = res.code;
      }
    }

    // Per-seller delivery (added on top of the discounted items total). Snapshot
    // the per-org split for payouts.
    const shipLines = await cartShippingLines(items);
    const shippingByOrg: Record<string, number> = {};
    let shippingTotal = 0;
    for (const l of shipLines) {
      if (l.shippingUsd > 0) {
        const c = convertCents(l.shippingUsd, currency, exchangeRate);
        shippingByOrg[l.orgId] = c;
        shippingTotal += c;
      }
    }
    totalInCurrency += shippingTotal;

    const order = await createCodOrder({
      userId: user.id,
      totalInCurrency,
      currency,
      exchangeRate,
      items,
      couponId: appliedCouponId,
      couponCode: appliedCouponCode,
      shippingTotal,
      shippingByOrg,
      shipping: {
        name: shipping.name,
        line1: shipping.line1,
        line2: shipping.line2 ?? null,
        city: shipping.city,
        state: shipping.state ?? null,
        postalCode: shipping.postalCode,
        country: shipping.country,
      },
      locale,
    });

    // Fire-and-forget - notification failure must not block the order
    publishCodOrderPlaced(order.id, locale, currency).catch((err) =>
      console.error("[notifications] publishCodOrderPlaced failed", err),
    );

    return { orderId: order.id };
  } catch (err) {
    console.error("[createCodCheckout]", err);
    return handleActionError(err);
  }
}