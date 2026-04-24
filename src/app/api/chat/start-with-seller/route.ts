import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { prisma } from "@/core/db/prisma";
import { env } from "@/env/server";

/**
 * POST /api/chat/start-with-seller
 * Body: { productId: string }
 *
 * Resolves the seller (org owner) from the product's organizationId,
 * then creates or returns an existing conversation between the
 * authenticated buyer and the seller.
 */
export async function POST(request: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const ctx = await resolveRequestContext();
  const buyerId = ctx.userId;

  let body: { productId?: string };
  try {
    body = await request.json() as { productId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  // 1. Find the product
  const product = await prisma.product.findUnique({
    where: { id: body.productId },
    select: { id: true, title: true, organizationId: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // 2. Find the org owner (the "seller")
  const ownerMembership = await prisma.membership.findFirst({
    where: { orgId: product.organizationId, role: "OWNER" },
    select: { userId: true },
  });

  const sellerUserId = ownerMembership?.userId;
  if (!sellerUserId) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  }

  if (sellerUserId === buyerId) {
    return NextResponse.json(
      { error: "Cannot message your own product" },
      { status: 400 }
    );
  }

  // 3. Issue a chat token for the buyer
  const tokenRes = await fetch(`${env.CHAT_HTTP_API_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.CHAT_INTERNAL_API_KEY,
    },
    body: JSON.stringify({ userId: buyerId }),
  });
  if (!tokenRes.ok) {
    return NextResponse.json({ error: "Failed to issue chat token" }, { status: 500 });
  }
  const { token } = await tokenRes.json() as { token: string };

  // 4. Create or return existing conversation
  const convRes = await fetch(`${env.CHAT_HTTP_API_URL}/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ participants: [buyerId, sellerUserId] }),
  });

  if (!convRes.ok) {
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }

  const conv = await convRes.json() as { conversationId: string; existed: boolean };

  return NextResponse.json({
    conversationId: conv.conversationId,
    productTitle: product.title,
  });
}