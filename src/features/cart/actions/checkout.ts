"use server";
import { captureError } from "@/lib/logger";
import { observeRequest } from "@/lib/observability/requestContext";

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
import { moneyIn, parseMoney, type MoneySet } from "@/lib/money";
import { VALID_CURRENCIES, type Currency } from "@/lib/currency-config";
import { asLocale, type Locale } from "@/i18n/config";
import { getProductTitle } from "@/features/products/utils/translations";
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

// Observed (ROADMAP #23). The wrapper is a separate function purely so the
// 240-line body below keeps its indentation - `observeRequest` only needs to
// own the outermost call. A returned error result is reported as 400 (a
// business rejection: empty cart, signed out); a genuine fault is what tags
// itself `event: "checkout_failed"` in the catch.
export async function createCheckoutSession(
  items: CheckoutCartItem[],
  couponCode?: string,
): Promise<{ url: string } | ActionErrorResult> {
  return observeRequest(
    "action createCheckoutSession",
    () => runCheckoutSession(items, couponCode),
    { statusOf: (result) => ("error" in result ? 400 : 200) },
  );
}

/**
 * The app locale, translated into one Stripe's hosted page actually accepts.
 *
 * Stripe does not support Serbian, so `sr` cannot be honoured: the hosted page
 * has no Serbian text to render. The fallback is English rather than Croatian -
 * `hr` would at least write dinars the right way round (9.949,41 RSD instead of
 * RSD 9,949.41), but showing a Croatian page to a buyer on a Serbian
 * marketplace was judged worse than showing a plainly foreign one.
 *
 * Typed as a total Record, so adding a locale to the app fails here until
 * someone decides what Stripe should do with it, rather than silently falling
 * back to whatever the browser happens to ask for.
 */
const STRIPE_LOCALE: Record<Locale, Stripe.Checkout.SessionCreateParams.Locale> = {
  en: "en",
  de: "de",
  es: "es",
  sr: "en",
};

async function runCheckoutSession(
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
    // The cart total in the buyer's currency, accumulated from the same
    // per-line amounts Stripe is charged. Coupon minimums and the discount cap
    // are judged against this, not against a conversion of `subtotalUsd`.
    let subtotalInCurrency = 0;

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
      // Each step tests for a NON-BLANK title, not merely a present row: a
      // locale can have a translation row (kept alive by its slug/description)
      // whose title was left empty, and `??` would stop there and send Stripe
      // a blank line item. `getProductTitle` closes out the en/any-row tail.
      const localeTitle = (loc: string) =>
        product.translations.find((tr) => tr.locale === loc)?.title?.trim() || "";
      const productTitle =
        localeTitle(locale) ||
        localeTitle(user.locale) ||
        getProductTitle(product, locale);

      let unitPriceUsdCents: number;
      // The USD mirror above drives the coupon subtotal; this is what Stripe
      // actually charges.
      let unitMoney: MoneySet | null;
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
        unitPriceUsdCents = Number(variant.price);
        unitMoney = parseMoney(variant.priceMoney, unitPriceUsdCents);
        itemName = `${productTitle} (${variant.sku})`;
      } else {
        unitPriceUsdCents = Number(product.price);
        unitMoney = parseMoney(product.priceMoney, unitPriceUsdCents);
      }

      if (!product.isDigital && product.requiresShipping) {
        needsShipping = true;
      }

      subtotalUsd += unitPriceUsdCents * item.quantity;

      // The exact amount stored for the buyer's currency - the same number the
      // product page showed. Not a conversion of the USD mirror.
      const unitAmountInCurrency = unitMoney
        ? moneyIn(unitMoney, currency, { [currency]: exchangeRate })
        : convertCents(unitPriceUsdCents, currency, exchangeRate);

      const variantMedia = item.variantId
        ? product.variants.find((v) => v.id === item.variantId)?.media[0]?.media
        : undefined;
      const variantImageUrl =
        variantMedia && variantMedia.mediaType === "IMAGE"
          ? (variantMedia.thumbUrl ?? variantMedia.url)
          : undefined;
      const imageUrl = variantImageUrl ?? product.media[0]?.url;

      subtotalInCurrency += unitAmountInCurrency * item.quantity;

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
      const res = await validateCoupon(couponCode, subtotalUsd, user.id, {
        currency,
        rates: { [currency]: exchangeRate },
        subtotal: subtotalInCurrency,
      });
      if (res.ok && res.discountUsd > 0) {
        const stripeCoupon = await stripe.coupons.create(
          res.type === CouponType.PERCENT
            ? { percent_off: res.value, duration: "once", max_redemptions: 1 }
            : {
                // Already resolved in the buyer's currency and capped at the
                // cart, so a "500 RSD off" coupon takes off exactly 500 RSD
                // rather than 499 or 501 depending on the day's rate.
                amount_off: res.discount,
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
    const shipLines = await cartShippingLines(items, {
      currency,
      rates: { [currency]: exchangeRate },
    });
    const shippingByOrg: Record<string, number> = {};
    let shippingTotal = 0;
    for (const l of shipLines) {
      // `l.shipping` is already the seller's exact fee in the buyer's currency,
      // with the free-shipping rule applied in that same currency.
      if (l.shipping > 0) {
        shippingByOrg[l.orgId] = l.shipping;
        shippingTotal += l.shipping;
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
      // The buyer's own language on the hosted page. Without it Stripe falls back
      // to `auto`, guesses from the browser and served an English page - which
      // also formatted the total as "RSD 9,949.41" rather than "9.949,41 RSD".
      // `metadata.locale` below deliberately stays the real app locale: the
      // webhook and the order row need what the buyer actually browsed in, not
      // what Stripe was able to render.
      locale: STRIPE_LOCALE[locale],
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
    captureError(error, { event: "checkout_failed", paymentMethod: "stripe" });
    return handleActionError(error);
  }
}