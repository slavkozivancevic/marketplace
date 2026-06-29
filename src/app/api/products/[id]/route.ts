import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { prisma } from "@/core/db/prisma";
import {
  publicProductInclude,
  serializePublicProduct,
} from "@/features/products/db/variantCompat";

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
  });
}