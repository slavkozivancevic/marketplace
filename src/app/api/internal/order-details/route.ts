import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env/server";
import { prisma } from "@/core/db/prisma";
import { getEmailThumbUrl } from "@/services/emailThumb";
import {
  PLATFORM_FEE_PERCENT,
  platformFeeAmount,
  sellerNetAmount,
} from "@/features/payments/config";

/**
 * GET /api/internal/order-details?id={orderId}
 *
 * Internal-only endpoint called by the marketplace-notifications Lambda.
 * Protected by x-api-key. Returns full order context needed to dispatch
 * buyer and seller notification emails.
 *
 * Response shape:
 * {
 *   id, total,
 *   buyer: { email, name },
 *   items: [{ name, quantity, price, orgId }],
 *   shipping?: { name, line1, line2, city, state, postalCode, country },
 *   sellers: [{ orgId, orgName, members: [{ email, locale }], items }]
 * }
 *
 * Note: `sellers[].members` carries per-recipient locale so the Lambda can
 * group recipients by language and dispatch one email per locale - sellers
 * in the same org may prefer different languages.
 */
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== env.NOTIFICATIONS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orderId = request.nextUrl.searchParams.get("id");
  if (!orderId?.trim()) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { email: true, name: true } },
      items: {
        include: {
          // Thumbnail for the email item rows: prefer the ordered variant's
          // image, fall back to the product's first image. URLs are public S3.
          variant: {
            select: {
              media: {
                orderBy: { order: "asc" },
                take: 1,
                select: {
                  media: {
                    select: { url: true, thumbUrl: true, key: true, thumbKey: true },
                  },
                },
              },
            },
          },
          product: {
            select: {
              // Notification emails are sent in `order.locale` (captured at
              // checkout). We pull every translation row and pick the right
              // one per item below so each notification reads in the buyer's
              // language at order time.
              translations: { select: { locale: true, title: true } },
              media: {
                orderBy: { order: "asc" },
                take: 1,
                where: { mediaType: "IMAGE" },
                select: { url: true, thumbUrl: true, key: true, thumbKey: true },
              },
              organizationId: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  members: {
                    where: { role: { in: ["OWNER", "ADMIN"] } },
                    include: {
                      user: { select: { email: true, locale: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Group order items by seller organisation
  const sellerMap = new Map<
    string,
    {
      orgId: string;
      orgName: string;
      members: { email: string; locale: string }[];
      items: { name: string; quantity: number; price: number; orgId: string; imageUrl: string | null }[];
    }
  >();

  const allItems = await Promise.all(order.items.map(async (item) => {
    const org = item.product.organization;
    const title =
      item.product.translations.find((tr) => tr.locale === order.locale)?.title ??
      item.product.translations.find((tr) => tr.locale === "en")?.title ??
      "";
    // Prefer the ordered variant's image, fall back to the product's first
    // image. Resolve to a public JPEG (email clients don't render our WebP
    // thumbnails) - generated and cached on first use.
    const src = item.variant?.media[0]?.media ?? item.product.media[0] ?? null;
    const fallbackUrl = src?.thumbUrl ?? src?.url ?? null;
    const imageUrl = src
      ? await getEmailThumbUrl(src.key, src.thumbKey, fallbackUrl)
      : null;
    return {
      name: title,
      quantity: item.quantity,
      price: Number(item.price),
      imageUrl,
      orgId: org.id,
      orgName: org.name,
      members: org.members.map((m) => ({
        email: m.user.email,
        locale: m.user.locale,
      })),
    };
  }));

  for (const item of allItems) {
    if (!sellerMap.has(item.orgId)) {
      sellerMap.set(item.orgId, {
        orgId: item.orgId,
        orgName: item.orgName,
        members: item.members,
        items: [],
      });
    }
    sellerMap.get(item.orgId)!.items.push({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      imageUrl: item.imageUrl,
      orgId: item.orgId,
    });
  }

  const shipping =
    order.shippingLine1
      ? {
          name: order.shippingName,
          line1: order.shippingLine1,
          line2: order.shippingLine2,
          city: order.shippingCity,
          state: order.shippingState,
          postalCode: order.shippingPostalCode,
          country: order.shippingCountry,
        }
      : undefined;

  // Per-seller earnings breakdown, from the single source of truth in payments
  // config. For COD the seller collects the full cash and owes `commission` as a
  // FEE; `netPayout` is what they keep. Surfaced so the COD email can show it -
  // COD has no payout email where net would otherwise appear (card does).
  const sellers = [...sellerMap.values()].map((seller) => {
    const subtotal = seller.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    return {
      ...seller,
      commission: platformFeeAmount(subtotal),
      netPayout: sellerNetAmount(subtotal),
    };
  });

  return NextResponse.json({
    id: order.id,
    // `total` is already net of any coupon discount.
    total: Number(order.total),
    discountAmount: order.discountAmount,
    couponCode: order.couponCode,
    locale: order.locale,
    currency: order.currency ?? "usd",
    buyer: {
      email: order.user.email,
      name: order.user.name,
    },
    items: allItems.map(({ name, quantity, price, orgId, imageUrl }) => ({ name, quantity, price, orgId, imageUrl })),
    shipping,
    feePercent: PLATFORM_FEE_PERCENT,
    sellers,
  });
}