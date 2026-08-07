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
    select: {
      id: true,
      organizationId: true,
      createdById: true,
      // Chat header just shows a label - take the default-locale title.
      // Buyer can switch UI language elsewhere.
      translations: {
        where: { locale: "en" },
        select: { title: true },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // 2. Who to message: the product's creator, if they're still on the org -
  // real sellers are teams, not a single "owner", so route to whoever actually
  // manages the listing. Falls back to the OWNER when there's no creator (e.g.
  // legacy/bulk-imported rows) or the creator has since left the org.
  let sellerUserId: string | undefined;
  if (product.createdById) {
    const creatorMembership = await prisma.membership.findFirst({
      where: { userId: product.createdById, orgId: product.organizationId },
      select: { userId: true },
    });
    sellerUserId = creatorMembership?.userId;
  }
  if (!sellerUserId) {
    const ownerMembership = await prisma.membership.findFirst({
      where: { orgId: product.organizationId, role: "OWNER" },
      select: { userId: true },
    });
    sellerUserId = ownerMembership?.userId;
  }

  if (!sellerUserId) {
    return NextResponse.json({ error: "Seller not found" }, { status: 404 });
  }

  // Any member of the selling org is "the seller" here, not just whichever
  // user sellerUserId resolved to - otherwise a teammate messaging about a
  // colleague's product would slip through as an ordinary buyer-seller chat.
  const buyerMembership = await prisma.membership.findFirst({
    where: { userId: buyerId, orgId: product.organizationId },
    select: { id: true },
  });
  if (buyerMembership) {
    return NextResponse.json(
      { error: "Cannot message your own organization's product" },
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
      productTitle: product.translations[0]?.title ?? "",
    });
  } catch {
    return NextResponse.json({ error: "Failed to start conversation" }, { status: 500 });
  }
}