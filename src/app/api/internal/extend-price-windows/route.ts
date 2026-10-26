import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env/server";
import { prisma } from "@/core/db/prisma";
import { regenerateProductWindows } from "@/features/pricing/db/windows";
import { rollDue } from "@/features/pricing/db/roll";
import { revalidateProductCacheFromRoute } from "@/features/products/db/cache";
import { PRICE_REFERENCE_LOOKBACK_DAYS } from "@/features/pricing/schema/priceRules";

const DAY_MS = 86_400_000;

/**
 * POST /api/internal/extend-price-windows
 *
 * Internal-only, called MONTHLY by the marketplace-notifications
 * PriceWindowHorizon cron. Protected by x-api-key.
 *
 * Correctness never depends on this route: prices flip on the first read after
 * each window boundary (src/features/pricing/db/roll.ts). All it does is keep
 * the materialised horizon ahead of open-ended recurring rules and prune what
 * nobody reads any more. A missed run degrades nothing for weeks, which is why
 * it can run once a month and let the database sleep the rest of the time.
 *
 * Invalidation uses the Route Handler variant: `updateTag` throws outside a
 * Server Action. It runs last, after every database write.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== env.NOTIFICATIONS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const products = await prisma.product.findMany({
    where: { deletedAt: null, priceRules: { some: { active: true, kind: "SCHEDULE" } } },
    select: { id: true, organizationId: true },
  });

  let windows = 0;
  for (const p of products) {
    const r = await prisma.$transaction((tx) => regenerateProductWindows(tx, p.id, now));
    windows += r.windows;
  }

  // Ended windows are never read again; ledger points closed beyond the
  // lookback can no longer be anyone's reference price.
  const prunedWindows = await prisma.priceWindow.deleteMany({ where: { endsAt: { lt: now } } });
  const prunedPoints = await prisma.pricePoint.deleteMany({
    where: { endedAt: { lt: new Date(now.getTime() - (PRICE_REFERENCE_LOOKBACK_DAYS + 1) * DAY_MS) } },
  });

  // Roll now rather than on the next read, so the invalidation below exposes
  // the new state straight away.
  await rollDue(now);

  for (const p of products) revalidateProductCacheFromRoute(p.organizationId, p.id);

  logger.info(
    `[extend-price-windows] ${products.length} product(s), ${windows} window(s), ` +
      `pruned ${prunedWindows.count} window(s) and ${prunedPoints.count} point(s)`,
  );
  return NextResponse.json({
    products: products.length,
    windows,
    pruned: { windows: prunedWindows.count, points: prunedPoints.count },
  });
}
