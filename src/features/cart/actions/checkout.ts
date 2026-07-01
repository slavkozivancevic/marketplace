"use server";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/core/db/prisma";
import { stripe } from "@/services/stripe";
import { env } from "@/env/server";
import { ActionErrorResult } from "@/types/types";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { enforceRateLimit, getClientIp } from "@/lib/rateLimit/guard";
import { getCurrencyRate } from "@/features/currency/db/currencyRates";
import { convertCents } from "@/lib/currency";
import { VALID_CURRENCIES, type Currency } from "@/lib/currency-config";
import { asLocale } from "@/i18n/config";
import { getPathname } from "@/i18n/navigation";
import { validateCoupon } from "@/features/coupons/db/coupons";
import { cartShippingLines } from "@/features/shipping/db/shipping";
import { CouponType } from "@/generated/prisma/client";
import type Stripe from "stripe";

export type CheckoutCartItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
};

export async function createCheckoutSession(
  items: CheckoutCartItem[],
  couponCode?: string,
): Promise<{ url: string } | ActionErrorResult> {
  try {
    const { userId: clerkUserId } = await auth();
    await enforceRateLimit("checkout", clerkUserId ?? (await getClientIp()));
    const cookieStore = await cookies();
    const locale = asLocale(cookieStore.get("NEXT_LOCALE")?.value);
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
      select: { id: true, email: true, locale: true },
    });

    if (!user) {
      return { error: true, message: t("userNotFound") };
    }

    if (items.length === 0) {
      return { error: true, message: t("cartEmpty") };
    }

    // Fetch exchange rate once for the entire session
    const exchangeRate = await getCurrencyRate(currency);

    // Validate and fetch each item from DB - never trust client prices
    const lineItems: {
      price_data: {
        currency: string;
        product_data: { name: string; images?: string[] };
        unit_amount: number;
      };
      quantity: number;
    }[] = [];

    let needsShipping = false;
    let subtotalUsd = 0;

    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, status: "PUBLISHED", deletedAt: null },
        include: {
          // Title is read per-locale from translations - we only need the
          // buyer's locale row plus the default-locale fallback, but pulling
          // the whole relation keeps the query simple and the payload tiny.
          translations: { select: { locale: true, title: true } },
          // Stripe checkout shows a still preview - keep image-only so a
          // video poster isn't sent as a "product image".
          media: {
            orderBy: { order: "asc" },
            take: 1,
            where: { mediaType: "IMAGE" },
          },
          variants: {
            include: {
              media: {
                orderBy: { order: "asc" },
                take: 1,
                include: { media: true },
              },
            },
          },
        },
      });

      if (!product) {
        return {
          error: true,
          message: t("productNotAvailable"),
        };
      }

      // Stripe line items use the buyer's active checkout locale (read from
      // the NEXT_LOCALE cookie above, e.g. "sr" on /sr/placanje) so the names
      // match the currency and the language the buyer saw in the cart. Fall
      // back to the user's saved locale, then English, then any row.
      const productTitle =
        product.translations.find((tr) => tr.locale === locale)?.title ??
        product.translations.find((tr) => tr.locale === user.locale)?.title ??
        product.translations.find((tr) => tr.locale === "en")?.title ??
        product.translations[0]?.title ??
        "";

      let unitPriceUsdCents: number;
      let itemName = productTitle;

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          return { error: true, message: t("variantNotFoundFor", { title: productTitle }) };
        }
        if (variant.stock < item.quantity) {
          return {
            error: true,
            message: t("notEnoughStockFor", { title: productTitle }),
          };
        }
        unitPriceUsdCents = Number(variant.price); // Int after migration; Number() is safe for both Decimal and Int
        itemName = `${productTitle} (${variant.sku})`;
      } else {
        unitPriceUsdCents = Number(product.price); // Int after migration
      }

      if (!product.isDigital && product.requiresShipping) {
        needsShipping = true;
      }

      subtotalUsd += unitPriceUsdCents * item.quantity;

      // Convert from USD cents to target currency's smallest unit
      const unitAmountInCurrency = convertCents(unitPriceUsdCents, currency, exchangeRate);

      const variantMedia = item.variantId
        ? product.variants.find((v) => v.id === item.variantId)?.media[0]?.media
        : undefined;
      const variantImageUrl =
        variantMedia && variantMedia.mediaType === "IMAGE"
          ? (variantMedia.thumbUrl ?? variantMedia.url)
          : undefined;
      const imageUrl = variantImageUrl ?? product.media[0]?.url;

      lineItems.push({
        price_data: {
          currency: currency, // Stripe accepts lowercase ISO 4217
          product_data: {
            name: itemName,
            ...(imageUrl ? { images: [imageUrl] } : {}),
          },
          unit_amount: unitAmountInCurrency,
        },
        quantity: item.quantity,
      });
    }

    // Coupon: re-validate server-side against the DB subtotal (never trust the
    // client) and translate it into a one-off Stripe discount. Stripe reduces
    // `amount_total`, which the webhook already reads - so the charged amount is
    // automatically net of the discount.
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    const couponMeta: Record<string, string> = {};
    if (couponCode) {
      const res = await validateCoupon(couponCode, subtotalUsd);
      if (res.ok && res.discountUsd > 0) {
        const stripeCoupon = await stripe.coupons.create(
          res.type === CouponType.PERCENT
            ? { percent_off: res.value, duration: "once", max_redemptions: 1 }
            : {
                amount_off: convertCents(res.value, currency, exchangeRate),
                currency,
                duration: "once",
                max_redemptions: 1,
              },
        );
        discounts = [{ coupon: stripeCoupon.id }];
        couponMeta.couponId = res.couponId;
        couponMeta.couponCode = res.code;
      }
    }

    // Per-seller delivery: a single Stripe shipping rate (sum of each org's fee),
    // added on top of the line items - Stripe coupons only discount line items,
    // so shipping is never reduced. Snapshot the per-org split for payouts via
    // metadata; the webhook stores it on the order.
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
    const tCheckout = await getTranslations("checkout");
    const shippingMeta: Record<string, string> =
      shippingTotal > 0
        ? { shippingTotal: String(shippingTotal), shippingByOrg: JSON.stringify(shippingByOrg) }
        : {};

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: user.email,
      ...(discounts && { discounts }),
      ...(shippingTotal > 0 && {
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: { amount: shippingTotal, currency },
              display_name: tCheckout("shipping"),
            },
          },
        ],
      }),
      ...(needsShipping && {
        shipping_address_collection: {
          allowed_countries: ["US", "CA", "GB", "DE", "FR", "AU", "NL", "SE", "NO", "DK", "FI", "IT", "ES", "PT", "BE", "AT", "CH", "PL", "RS", "HR", "BA", "ME", "SI", "MK", "AL"],
        },
      }),
      metadata: {
        userId: user.id,
        locale,
        currency,
        exchangeRate: String(exchangeRate),
        ...couponMeta,
        ...shippingMeta,
        items: JSON.stringify(
          items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        ),
      },
      // Localized return URLs: Stripe redirects the buyer back to the
      // marketplace path that matches their checkout-time locale
      // (e.g. /sr/placanje/uspesno, /de/kasse/erfolgreich) instead of
      // the canonical English path. Using getPathname keeps the slug
      // mapping in sync with routing.ts.
      success_url: `${env.APP_URL}${getPathname({ href: "/checkout/success", locale })}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}${getPathname({ href: "/checkout/cancel", locale })}`,
    });

    if (!session.url) {
      return { error: true, message: t("checkoutSessionFailed") };
    }

    return { url: session.url };
  } catch (error) {
    console.error("[createCheckoutSession]", error);
    return handleActionError(error);
  }
}