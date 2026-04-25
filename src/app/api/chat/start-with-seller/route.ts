import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { prisma } from "@/core/db/prisma";
import { env } from "@/env/server";
import axios from "axios";

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

  try {
    // 3. Issue a chat token for the buyer
    const { data: tokenData } = await axios.post<{ token: string }>(
      `${env.CHAT_HTTP_API_URL}/auth/token`,
      { userId: buyerId },
      { headers: { "x-api-key": env.CHAT_INTERNAL_API_KEY } }
    );

    // 4. Create or return existing conversation
    const { data: conversation } = await axios.post<{ conversationId: string; existed: boolean }>(
      `${env.CHAT_HTTP_API_URL}/conversations`,
      { participants: [buyerId, sellerUserId] },
      { headers: { Authorization: `Bearer ${tokenData.token}` } }
    );

    return NextResponse.json({
      conversationId: conversation.conversationId,
      productTitle: product.title,
    });
  } catch {
    return NextResponse.json({ error: "Failed to start conversation" }, { status: 500 });
  }
}