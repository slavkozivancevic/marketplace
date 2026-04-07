"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";
import { stripe } from "@/services/stripe";
import { env } from "@/env/server";
import { ActionErrorResult } from "@/types/types";
import { handleActionError } from "@/features/common/errors/domainErrors";

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

    // Validate and fetch each item from DB — never trust client prices
    const lineItems: {
      price_data: {
        currency: string;
        product_data: { name: string; images?: string[] };
        unit_amount: number;
      };
      quantity: number;
    }[] = [];

    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, status: "PUBLISHED", deletedAt: null },
        include: {
          images: { orderBy: { order: "asc" }, take: 1 },
          variants: true,
        },
      });

      if (!product) {
        return {
          error: true,
          message: `Product not found or no longer available`,
        };
      }

      let unitPrice: number;
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
        unitPrice = Number(variant.price);
        itemName = `${product.title} (${variant.sku})`;
      } else {
        unitPrice = Number(product.price);
      }

      const imageUrl = product.images[0]?.url;

      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: itemName,
            ...(imageUrl ? { images: [imageUrl] } : {}),
          },
          unit_amount: Math.round(unitPrice * 100), // Stripe expects cents
        },
        quantity: item.quantity,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: user.email,
      metadata: {
        userId: user.id,
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
