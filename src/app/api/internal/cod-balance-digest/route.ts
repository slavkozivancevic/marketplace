import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env/server";
import { prisma } from "@/core/db/prisma";
import { getAllCodBalances } from "@/features/payments/db/payouts";

/**
 * GET /api/internal/cod-balance-digest
 *
 * Internal-only endpoint for the weekly COD-balance digest Lambda. Protected
 * by x-api-key. Returns every org currently owing COD commission (see
 * OrgBalance) plus the admin recipients (with their locale) - mirrors
 * /api/internal/review-digest.
 */
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== env.NOTIFICATIONS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [balances, admins] = await Promise.all([
    getAllCodBalances(),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { email: true, locale: true },
    }),
  ]);

  return NextResponse.json({
    count: balances.length,
    balances: balances.map((b) => ({
      organizationName: b.organizationName,
      currency: b.currency,
      owedAmount: b.owedAmount,
    })),
    recipients: admins.map((a) => ({ email: a.email, locale: a.locale })),
  });
}
