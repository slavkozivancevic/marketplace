import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env/server";
import { prisma } from "@/core/db/prisma";

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
 *   sellers: [{ orgId, orgName, memberEmails, items }]
 * }
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
          product: {
            select: {
              title: true,
              organizationId: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  members: {
                    where: { role: { in: ["OWNER", "ADMIN"] } },
                    include: {
                      user: { select: { email: true } },
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
      memberEmails: string[];
      items: { name: string; quantity: number; price: number; orgId: string }[];
    }
  >();

  const allItems = order.items.map((item) => {
    const org = item.product.organization;
    return {
      name: item.product.title,
      quantity: item.quantity,
      price: Number(item.price),
      orgId: org.id,
      orgName: org.name,
      memberEmails: org.members.map((m) => m.user.email),
    };
  });

  for (const item of allItems) {
    if (!sellerMap.has(item.orgId)) {
      sellerMap.set(item.orgId, {
        orgId: item.orgId,
        orgName: item.orgName,
        memberEmails: item.memberEmails,
        items: [],
      });
    }
    sellerMap.get(item.orgId)!.items.push({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
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

  return NextResponse.json({
    id: order.id,
    total: Number(order.total),
    locale: order.locale,
    currency: order.currency ?? "usd",
    buyer: {
      email: order.user.email,
      name: order.user.name,
    },
    items: allItems.map(({ name, quantity, price, orgId }) => ({ name, quantity, price, orgId })),
    shipping,
    sellers: [...sellerMap.values()],
  });
}