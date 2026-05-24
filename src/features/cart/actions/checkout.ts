"use server";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { prisma } from "@/core/db/prisma";
import { stripe } from "@/services/stripe";
import { env } from "@/env/server";
import { ActionErrorResult } from "@/types/types";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { getCurrencyRate } from "@/features/currency/db/currencyRates";
import { convertCents } from "@/lib/currency";
import { VALID_CURRENCIES, type Currency } from "@/lib/currency-config";

export type CheckoutCartItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
};

export async function createCheckoutSession(
  items: CheckoutCartItem[],
): Promise<{ url: string } | ActionErrorResult> {
  try {
    const { userId: clerkUserId } = await auth();
    const cookieStore = await cookies();
    const locale = cookieStore.get("NEXT_LOCALE")?.value ?? "en";
    const rawCurrency = cookieStore.get("NEXT_CURRENCY")?.value ?? "usd";
    const currency: Currency = VALID_CURRENCIES.includes(rawCurrency as Currency)
      ? (rawCurrency as Currency)
      : "usd";

    if (!clerkUserId) {
      return { error: true, message: "You must be signed in to checkout" };
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true, email: true },
    });

    if (!user) {
      return { error: true, message: "User not found" };
    }

    if (items.length === 0) {
      return { error: true, message: "Cart is empty" };
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

    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, status: "PUBLISHED", deletedAt: null },
        include: {
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
          message: `Product not found or no longer available`,
        };
      }

      let unitPriceUsdCents: number;
      let itemName = product.title;

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          return { error: true, message: `Variant not found for ${product.title}` };
        }
        if (variant.stock < item.quantity) {
          return {
            error: true,
            message: `Not enough stock for ${product.title}`,
          };
        }
        unitPriceUsdCents = Number(variant.price); // Int after migration; Number() is safe for both Decimal and Int
        itemName = `${product.title} (${variant.sku})`;
      } else {
        unitPriceUsdCents = Number(product.price); // Int after migration
      }

      if (!product.isDigital && product.requiresShipping) {
        needsShipping = true;
      }

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

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: user.email,
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
        items: JSON.stringify(
          items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        ),
      },
      success_url: `${env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/checkout/cancel`,
    });

    if (!session.url) {
      return { error: true, message: "Failed to create checkout session" };
    }

    return { url: session.url };
  } catch (error) {
    console.error("[createCheckoutSession]", error);
    return handleActionError(error);
  }
}