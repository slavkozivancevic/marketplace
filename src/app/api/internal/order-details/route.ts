import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env/server";
import { prisma } from "@/core/db/prisma";
import { getEmailThumbUrl } from "@/services/emailThumb";
import { getVariantLabel } from "@/features/attributes/utils/translations";
import { getProductTitle } from "@/features/products/utils/translations";
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
 *   items: [{ name, variantLabel, quantity, price, orgId }],
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
              // ...and the option labels, so a line in the email says WHICH
              // variant was ordered. Without them two lines of the same
              // product in different colours read as one repeated item.
              attributeValues: {
                select: {
                  option: { select: { translations: { select: { locale: true, label: true } } } },
                },
              },
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

  /**
   * One line item, as every email prints it.
   *
   * Built once and handed out by reference to both the buyer's list and the
   * seller groups below. It used to be re-listed field by field in each of
   * those two places, and a field added to the source reached neither: that is
   * how `variantLabel` went missing from all sixteen emails on the day it was
   * given its own field.
   */
  type EmailLine = {
    name: string;
    variantLabel: string | null;
    quantity: number;
    price: number;
    orgId: string;
    imageUrl: string | null;
  };

  // Group order items by seller organisation
  const sellerMap = new Map<
    string,
    {
      orgId: string;
      orgName: string;
      members: { email: string; locale: string }[];
      items: EmailLine[];
    }
  >();

  const allItems = await Promise.all(order.items.map(async (item) => {
    const org = item.product.organization;
    // `getProductTitle` (not a raw `find(locale)?.title ?? ...`) - a locale
    // can HAVE a translation row whose title was left blank, and `??` would
    // then put an empty line in the email instead of falling back to English.
    const title = getProductTitle(item.product, order.locale);
    // Sent as its OWN field, never glued onto the name: the email prints it on
    // a second, quieter line, exactly as the order pages and the invoice do.
    const variantLabel = getVariantLabel(item.variant, order.locale);
    // Prefer the ordered variant's image, fall back to the product's first
    // image. Resolve to a public JPEG (email clients don't render our WebP
    // thumbnails) - generated and cached on first use.
    const src = item.variant?.media[0]?.media ?? item.product.media[0] ?? null;
    const fallbackUrl = src?.thumbUrl ?? src?.url ?? null;
    const imageUrl = src
      ? await getEmailThumbUrl(src.key, src.thumbKey, fallbackUrl)
      : null;
    const line: EmailLine = {
      name: title,
      variantLabel,
      quantity: item.quantity,
      price: Number(item.price),
      orgId: org.id,
      imageUrl,
    };
    // The org's members are grouping data, not part of a line - they stay
    // outside `line` so they can never ride along into an email payload.
    return {
      line,
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
    sellerMap.get(item.orgId)!.items.push(item.line);
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
  // config. For COD the seller collects the cash itself and owes `commission` as
  // a FEE; `netPayout` is what they keep. Surfaced so the COD email can show it -
  // COD has no payout email where net would otherwise appear (card does).
  // Per-seller delivery snapshot (orgId -> amount). Shipping goes to the seller
  // in full (no platform fee), so it adds on top of their net items share.
  const shippingByOrg = (order.shippingByOrg as Record<string, number> | null) ?? {};

  // Each seller's own stage within the order. A template needs this to tell
  // "the whole order was cancelled" from "one seller withdrew and the rest is
  // still coming" - the two are very different emails to receive.
  const parts = await prisma.orderSellerPart.findMany({
    where: { orderId: order.id },
    select: {
      organizationId: true,
      status: true,
      cancelledAt: true,
      codSettledAt: true,
      // This seller's slice of the buyer's coupon. On a COD order it comes
      // straight off the cash at the door, so the seller's email has to state
      // what to collect rather than let them add goods and delivery themselves.
      discountShare: true,
      itemsSubtotal: true,
      shippingAmount: true,
    },
  });
  const partByOrg = new Map(parts.map((p) => [p.organizationId, p]));
  const activeSellerCount = parts.filter((p) => p.cancelledAt == null).length;

  const sellers = [...sellerMap.values()].map((seller) => {
    const subtotal = seller.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    const shipping = shippingByOrg[seller.orgId] ?? 0;
    const part = partByOrg.get(seller.orgId);
    const discountShare = part?.discountShare ?? 0;
    return {
      ...seller,
      // Commission NET of the coupon slice the platform funds, which is exactly
      // what markCodPaymentReceived books against the seller. Sending the gross
      // here would print a number the ledger never charges.
      //
      // Signed, and the sign is the direction: negative means the coupon ran
      // deeper than the commission and the PLATFORM owes this seller. The email
      // reads that sign to choose its closing line, so it must be sent through
      // as-is - never clamped at zero on the way out.
      commission: platformFeeAmount(subtotal) - discountShare,
      grossCommission: platformFeeAmount(subtotal),
      discountShare,
      shipping,
      // What the courier takes at the door: goods less this part's coupon share,
      // plus its delivery. Identical to how the order total itself is built.
      cashToCollect: subtotal - discountShare + shipping,
      // Unchanged by the coupon, on purpose - that is the promise being kept.
      netPayout: sellerNetAmount(subtotal) + shipping,
      status: part?.status ?? null,
      cancelled: part?.cancelledAt != null,
      codSettled: part?.codSettledAt != null,
    };
  });

  return NextResponse.json({
    id: order.id,
    // `total` is already net of any coupon discount; it includes shipping.
    total: Number(order.total),
    discountAmount: order.discountAmount,
    shippingTotal: order.shippingTotal,
    couponCode: order.couponCode,
    locale: order.locale,
    currency: order.currency ?? "usd",
    buyer: {
      email: order.user.email,
      name: order.user.name,
    },
    // Buyer-facing lines. Every buyer email prints these under the order totals,
    // and those totals are rebuilt from the sellers still in the order
    // (syncOrderFromParts), so a withdrawn seller's lines have to drop out with
    // them or the email would not add up.
    //
    // The exception is the same one that function makes: when NO seller is left
    // the order's figures are frozen as a record of what it was, so the lines
    // stay whole to match. A cancellation email with an empty item table would
    // tell the buyer nothing about what they lost.
    //
    // Per-seller emails do not read this - they use `sellers[].items`, which
    // always carries the seller's own lines, cancelled or not.
    items: (activeSellerCount === 0
      ? allItems
      : allItems.filter((item) => partByOrg.get(item.orgId)?.cancelledAt == null)
    ).map((item) => item.line),
    shipping,
    feePercent: PLATFORM_FEE_PERCENT,
    sellers,
    // Zero means every seller withdrew, so the order as a whole is cancelled.
    activeSellerCount,
    orderCancelled: order.cancelledAt != null,
  });
}