import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { prisma } from "@/core/db/prisma";
import { SerializedPublicProduct } from "@/types/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, status: "PUBLISHED", deletedAt: null },
    include: {
      images: { orderBy: { order: "asc" } },
      variants: {
        orderBy: { order: "asc" },
        include: {
          optionValues: true,
          images: true,
        },
      },
      options: {
        orderBy: { order: "asc" },
        include: { values: { orderBy: { id: "asc" } } },
      },
      brand: { select: { id: true, name: true, logoUrl: true } },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get rating breakdown
  const breakdown = await prisma.productReview.groupBy({
    by: ["rating"],
    where: { productId: id },
    _count: { rating: true },
  });

  const ratingBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of breakdown) {
    ratingBreakdown[row.rating] = row._count.rating;
  }

  const serialized: SerializedPublicProduct & { ratingBreakdown: Record<number, number> } = {
    ...product,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    costPrice: product.costPrice,
    variants: product.variants.map((v) => ({
      ...v,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      costPrice: v.costPrice,
    })),
    ratingBreakdown,
  };

  return NextResponse.json(serialized);
}