import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env/server";
import { prisma } from "@/core/db/prisma";

/**
 * POST /api/internal/currency-rates
 *
 * Internal-only endpoint called by the marketplace-notifications cron Lambda.
 * Protected by x-api-key. Upserts exchange rates into the CurrencyRate table.
 * USD is the base (always 1.0) and is not stored.
 *
 * Request body: { rates: { [code: string]: number } }
 * e.g. { rates: { eur: 0.921, rsd: 108.5 } }
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== env.NOTIFICATIONS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).rates !== "object"
  ) {
    return NextResponse.json({ error: "rates object is required" }, { status: 400 });
  }

  const rates = (body as { rates: Record<string, unknown> }).rates;
  const entries = Object.entries(rates).filter(
    ([code, rate]) => code !== "usd" && typeof rate === "number" && isFinite(rate) && rate > 0
  ) as [string, number][];

  if (entries.length === 0) {
    return NextResponse.json({ error: "No valid rates provided" }, { status: 400 });
  }

  await Promise.all(
    entries.map(([code, rate]) =>
      prisma.currencyRate.upsert({
        where: { code },
        update: { rate },
        create: { code, rate },
      })
    )
  );

  console.log(`[currency-rates] updated ${entries.length} rate(s):`, Object.fromEntries(entries));

  return NextResponse.json({ updated: entries.map(([code]) => code) });
}