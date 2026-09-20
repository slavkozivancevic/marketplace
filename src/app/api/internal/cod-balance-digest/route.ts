import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env/server";
import { prisma } from "@/core/db/prisma";
import { getAllCodBalances } from "@/features/payments/db/payouts";

/**
 * GET /api/internal/cod-balance-digest
 *
 * Internal-only endpoint for the weekly COD-balance digest Lambda. Protected
 * by x-api-key, and mirrors /api/internal/review-digest.
 *
 * Returns the COD balances (see OrgBalance) split by direction - `balances` is
 * commission orgs owe the platform, `credits` what the platform owes them for
 * coupons it funded on cash-on-delivery orders - plus the admin recipients with
 * their locale.
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

  // Debts only. `getAllCodBalances` also returns credits (the platform owing a
  // seller for funding a COD coupon - see markCodPaymentReceived), and this
  // digest is the collection worklist: a negative row would read as one more
  // organization to chase. Credits need no chasing - they leave on their own
  // with that seller's next payout - and the admin panel lists them.
  const owed = balances.filter((b) => b.owedAmount > 0);
  // The other direction, sent separately rather than mixed in: money the
  // platform owes a seller for funding a COD coupon. It normally clears itself
  // against their next Stripe transfer, so anything still sitting here belongs
  // to a seller who does not take card payments - and nobody would ever learn of
  // it without looking the admin page up on purpose. Amounts are sent positive;
  // the direction is the field they arrive in.
  const credits = balances
    .filter((b) => b.owedAmount < 0)
    .map((b) => ({
      organizationName: b.organizationName,
      currency: b.currency,
      owedAmount: -b.owedAmount,
    }));

  // Two arrays and nothing else. No counts beside them: the digest measures the
  // rows it can actually draw, and a figure that could disagree with its own
  // array is how an empty email got sent once already.
  return NextResponse.json({
    credits,
    balances: owed.map((b) => ({
      organizationName: b.organizationName,
      currency: b.currency,
      owedAmount: b.owedAmount,
    })),
    recipients: admins.map((a) => ({ email: a.email, locale: a.locale })),
  });
}
