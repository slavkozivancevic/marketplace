import { NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { productRepository } from "@/features/products/db/products";

export async function GET() {
  try {
    const ctx = await resolveRequestContext();

    requirePermission(ctx, "product:read");

    const repo = productRepository(ctx);

    const products = await repo.getAll();

    return NextResponse.json({
      products,
      organizationId: ctx.organizationId,
    });
  } catch (error: unknown) {
    console.error("Products API error:", error);

    return NextResponse.json(
      { error: (error as Error).message || "Internal error" },
      { status: 400 },
    );
  }
}