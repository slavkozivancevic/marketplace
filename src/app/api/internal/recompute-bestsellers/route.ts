import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env/server";
import { prisma } from "@/core/db/prisma";
import {
  BESTSELLER_WINDOW_DAYS,
  BESTSELLER_MIN_UNITS,
  BESTSELLER_TOP_N,
} from "@/constants/queryConstants";

/**
 * POST /api/internal/recompute-bestsellers
 *
 * Internal-only endpoint called by the marketplace-notifications
 * BestsellerRecompute cron (weekly). Protected by x-api-key. Recomputes
 * `Product.isBestseller`: a product qualifies when it's among the top
 * `BESTSELLER_TOP_N` sellers (by units, PAID/PARTIALLY_REFUNDED orders only)
 * in at least one of its categories over the trailing
 * `BESTSELLER_WINDOW_DAYS`, having cleared `BESTSELLER_MIN_UNITS`. This is an
 * algorithmic badge, independent of the manually-curated Tag system.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== env.NOTIFICATIONS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$transaction([
    prisma.$executeRaw`UPDATE "Product" SET "isBestseller" = false WHERE "isBestseller" = true`,
    prisma.$executeRaw`
      WITH windowed_sales AS (
        SELECT oi."productId" AS product_id, SUM(oi.quantity) AS qty
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        WHERE o."paymentStatus" IN ('PAID', 'PARTIALLY_REFUNDED')
          AND o."createdAt" >= NOW() - (INTERVAL '1 day' * ${BESTSELLER_WINDOW_DAYS})
        GROUP BY oi."productId"
      ),
      ranked AS (
        SELECT pc."categoryId", ws.product_id, ws.qty,
               ROW_NUMBER() OVER (PARTITION BY pc."categoryId" ORDER BY ws.qty DESC, ws.product_id) AS rnk
        FROM windowed_sales ws
        JOIN "ProductCategory" pc ON pc."productId" = ws.product_id
        WHERE ws.qty >= ${BESTSELLER_MIN_UNITS}
      )
      UPDATE "Product" p SET "isBestseller" = true
      FROM ranked r
      WHERE r.product_id = p.id AND r.rnk <= ${BESTSELLER_TOP_N}
    `,
  ]);

  const count = await prisma.product.count({ where: { isBestseller: true } });

  logger.info(`[recompute-bestsellers] ${count} product(s) flagged as bestseller`);

  return NextResponse.json({ updated: count });
}
