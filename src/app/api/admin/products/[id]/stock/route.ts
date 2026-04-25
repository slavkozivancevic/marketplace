import { NextResponse } from "next/server";

import { prisma } from "@/core/db/prisma";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const ctx = await resolveRequestContext();
  requirePermission(ctx, "product:read");

  const product = await prisma.product.findFirst({
    where: {
      id,
      organizationId: ctx.organizationId,
      deletedAt: null,
    },
    select: {
      stock: true,
      variants: {
        select: {
          id: true,
          stock: true,
        },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    stock: product.stock,
    variants: product.variants,
  });
}