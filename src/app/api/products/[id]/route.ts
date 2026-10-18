import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { prisma } from "@/core/db/prisma";
import {
  publicProductInclude,
  serializePublicProduct,
} from "@/features/products/db/variantCompat";
import { DEFAULT_RETURN_WINDOW_DAYS } from "@/features/returns/returnWindow";
import { parseMoney } from "@/lib/money";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, status: "PUBLISHED", deletedAt: null },
    include: publicProductInclude,
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // The selling org's promises, so quick view can show the same delivery
  // estimate and return window as the full product page instead of a quieter
  // version of it. Read here rather than folded into `publicProductInclude`:
  // that include feeds the detail page too, which already has them.
  const seller = await prisma.organization.findUnique({
    where: { id: product.organizationId },
    select: {
      shippingFlatRate: true,
      shippingFreeThresholdMoney: true,
      leadTimeMinDays: true,
      leadTimeMaxDays: true,
      returnWindowDays: true,
    },
  });

  // Get rating breakdown
  const breakdown = await prisma.productReview.groupBy({
    by: ["rating"],
    where: { productId: id, status: "APPROVED" },
    _count: { rating: true },
  });

  const ratingBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of breakdown) {
    ratingBreakdown[row.rating] = row._count.rating;
  }

  return NextResponse.json({
    ...serializePublicProduct(product),
    ratingBreakdown,
    sellerPolicy: {
      freeShippingAlways: (seller?.shippingFlatRate ?? 0) === 0,
      freeShippingThresholdMoney: parseMoney(seller?.shippingFreeThresholdMoney),
      leadTimeMinDays: seller?.leadTimeMinDays ?? null,
      leadTimeMaxDays: seller?.leadTimeMaxDays ?? null,
      returnWindowDays: seller?.returnWindowDays ?? DEFAULT_RETURN_WINDOW_DAYS,
    },
  });
}