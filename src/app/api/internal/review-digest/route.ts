import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env/server";
import { prisma } from "@/core/db/prisma";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getProductTitle } from "@/features/products/utils/translations";

/**
 * GET /api/internal/review-digest
 *
 * Internal-only endpoint for the weekly review-moderation digest Lambda.
 * Protected by x-api-key. Returns the count of reviews awaiting moderation,
 * the admin recipients (with their locale), and a few newest samples.
 *
 * Sample product names are rendered in the default locale - this is an internal
 * admin digest, and the email chrome is localized per recipient regardless.
 */
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== env.NOTIFICATIONS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [pendingCount, admins, sampleRows] = await Promise.all([
    prisma.productReview.count({ where: { status: "PENDING" } }),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { email: true, locale: true },
    }),
    prisma.productReview.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        rating: true,
        comment: true,
        createdAt: true,
        product: {
          select: { translations: { select: { locale: true, title: true } } },
        },
      },
    }),
  ]);

  return NextResponse.json({
    pendingCount,
    recipients: admins.map((a) => ({ email: a.email, locale: a.locale })),
    samples: sampleRows.map((r) => ({
      productName: getProductTitle(r.product, DEFAULT_LOCALE),
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
