"use server";
import { logger, captureError } from "@/lib/logger";
import { observeRequest } from "@/lib/observability/requestContext";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/core/db/prisma";
import { createCodOrder, type FulfillOrderItem } from "@/features/orders/db/orders";
import { resolveCart, type CartItemRef } from "@/features/cart/db/resolveCart";
import { getViewerMarket } from "@/features/priceMarkets/db/viewer";
import { publishCodOrderPlaced } from "@/services/notifications";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { isDemoReadOnlyEmail } from "@/features/demo/demoAccounts";
import { enforceRateLimit, getClientIp } from "@/lib/rateLimit/guard";
import { getCurrencyRate } from "@/features/currency/db/currencyRates";
import { moneyIn } from "@/lib/money";
import { validateCoupon } from "@/features/coupons/db/coupons";
import { shippingLinesForResolved } from "@/features/shipping/db/shipping";
import type { ActionErrorResult } from "@/types/types";
import type { CheckoutCartItem } from "./checkout";
import { normalizeCountryCode } from "@/lib/i18n/countries";
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

/**
 * Whether every line still has the stock it asks for. A product with untracked
 * stock (`null`) always does. The order write re-checks atomically
 * (`stock >= quantity` in the decrement), so this only turns the common race
 * into a readable message instead of a failed transaction.
 */
async function hasStockFor(items: CartItemRef[]): Promise<boolean> {
  const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId!);
  const productIds = items.filter((i) => !i.variantId).map((i) => i.productId);
  const [variants, products] = await Promise.all([
    variantIds.length
      ? prisma.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, stock: true } })
      : [],
    productIds.length
      ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, stock: true } })
      : [],
  ]);
  const stock = new Map<string, number | null>([
    ...variants.map((v) => [v.id, v.stock] as const),
    ...products.map((p) => [p.id, p.stock] as const),
  ]);
  return items.every((i) => {
    const s = stock.get(i.variantId ?? i.productId);
    return s === null || (s !== undefined && s >= i.quantity);
  });
}

// Observed (ROADMAP #23) - see the note on createCheckoutSession. Same shape,
// tagged `paymentMethod: "cod"` so one alarm covers both rails while the
// dashboard can still tell them apart.
export async function createCodCheckout(
  items: CheckoutCartItem[],
  shipping: CodShippingInput,
  couponCode?: string,
): Promise<{ orderId: string } | ActionErrorResult> {
  return observeRequest(
    "action createCodCheckout",
    () => runCodCheckout(items, shipping, couponCode),
    { statusOf: (result) => ("error" in result ? 400 : 200) },
  );
}

async function runCodCheckout(
  items: CheckoutCartItem[],
  shipping: CodShippingInput,
  couponCode?: string,
): Promise<{ orderId: string } | ActionErrorResult> {
  try {
    const { userId: clerkUserId } = await auth();
    await enforceRateLimit("checkout", clerkUserId ?? (await getClientIp()));
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
      select: { id: true, email: true },
    });

    if (!user) return { error: true, message: t("userNotFound") };
    if (isDemoReadOnlyEmail(user.email)) return { error: true, message: t("demoReadOnly") };
    if (items.length === 0) return { error: true, message: t("cartEmpty") };
    // The form only offers ISO codes; a request that skips the form does not
    // get to put free text on the label a courier reads.
    const shippingCountry = normalizeCountryCode(shipping.country);
    if (!shippingCountry) return { error: true, message: t("shippingCountryInvalid") };

    // Fetch exchange rate once for the entire order
    const exchangeRate = await getCurrencyRate(currency);

    // Server-side prices - never trust the client - from `resolveCart`, the one
    // place a cart line is priced: the effective price (any active schedule
    // rule, rolled first), then the buyer's market on top. The cart page, the
    // coupon check and the shipping thresholds all read the same resolution.
    const viewer = await getViewerMarket();
    const resolved = await resolveCart(items, viewer);
    if (resolved.unavailable.length > 0) {
      return { error: true, message: t("itemNoLongerAvailable") };
    }
    if (!(await hasStockFor(items))) {
      return { error: true, message: t("insufficientStock") };
    }

    let totalInCurrency = 0;
    let subtotalUsd = 0;
    // Each line with the exact price charged and the rules behind it, so the
    // order records this number rather than re-reading the catalogue.
    const pricedItems: FulfillOrderItem[] = [];
    for (const line of resolved.lines) {
      subtotalUsd += line.unitPriceUsd * line.quantity;
      // Charge the amount stored for this currency, not a conversion of the
      // USD mirror - same rule as the card path.
      const unitCents = moneyIn(line.unitMoney, currency, { [currency]: exchangeRate });
      totalInCurrency += unitCents * line.quantity;
      pricedItems.push({
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
        unitPrice: unitCents,
        priceRuleId: line.priceRuleId,
        priceRuleLabel: line.priceRuleLabel,
        marketRuleId: line.marketRuleId,
        marketRuleLabel: line.marketRuleLabel,
      });
    }

    // Coupon: re-validate server-side and subtract the discount from the COD
    // total (the item prices stay at full value, so subtotal - total = discount).
    let appliedCouponId: string | undefined;
    let appliedCouponCode: string | undefined;
    if (couponCode) {
      const res = await validateCoupon(couponCode, subtotalUsd, user.id, {
        currency,
        rates: { [currency]: exchangeRate },
        subtotal: totalInCurrency,
      });
      if (res.ok && res.discount > 0) {
        // Already resolved in the buyer's currency and capped at the cart.
        totalInCurrency = Math.max(0, totalInCurrency - res.discount);
        appliedCouponId = res.couponId;
        appliedCouponCode = res.code;
      }
    }

    // Per-seller delivery (added on top of the discounted items total). Snapshot
    // the per-org split for payouts.
    // From the lines resolved above, not a second resolution.
    const shipLines = await shippingLinesForResolved(resolved.lines, {
      currency,
      rates: { [currency]: exchangeRate },
    });
    const shippingByOrg: Record<string, number> = {};
    let shippingTotal = 0;
    for (const l of shipLines) {
      // Exact per-currency fee, free-shipping rule already applied in that
      // currency - see checkout.ts.
      if (l.shipping > 0) {
        shippingByOrg[l.orgId] = l.shipping;
        shippingTotal += l.shipping;
      }
    }
    totalInCurrency += shippingTotal;

    const order = await createCodOrder({
      userId: user.id,
      totalInCurrency,
      currency,
      exchangeRate,
      items: pricedItems,
      couponId: appliedCouponId,
      couponCode: appliedCouponCode,
      shippingTotal,
      shippingByOrg,
      pricingCountry: viewer.country,
      shipping: {
        name: shipping.name,
        line1: shipping.line1,
        line2: shipping.line2 ?? null,
        city: shipping.city,
        state: shipping.state ?? null,
        postalCode: shipping.postalCode,
        country: shippingCountry,
      },
      locale,
    });

    // Fire-and-forget - notification failure must not block the order
    publishCodOrderPlaced(order.id, locale, currency).catch((err) =>
      logger.error("[notifications] publishCodOrderPlaced failed", err),
    );

    return { orderId: order.id };
  } catch (err) {
    captureError(err, { event: "checkout_failed", paymentMethod: "cod" });
    return handleActionError(err);
  }
}