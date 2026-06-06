import { decimalToCents } from "@/lib/currency";
import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { productRepository } from "@/features/products/db/products";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { ProductStatus } from "@/generated/prisma/client";

function parseOptionalFloat(value: string | null): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
}

/**
 * Disjunctive facet counts (status + brand) for the admin product list
 * sidebar. Mirrors the filter parsing of `/api/admin/products` so the numbers
 * match the list exactly, minus each facet's own selection.
 */
export async function GET(req: NextRequest) {
  await connection();
  let ctx;
  try {
    ctx = await resolveRequestContext();
    requirePermission(ctx, "product:read");
  } catch (e) {
    return NextResponse.json(await handleActionError(e), { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? undefined;
  const status = searchParams
    .getAll("status")
    .filter((s): s is ProductStatus => Object.values(ProductStatus).includes(s as ProductStatus));
  const minPriceRaw = parseOptionalFloat(searchParams.get("minPrice"));
  const maxPriceRaw = parseOptionalFloat(searchParams.get("maxPrice"));
  const minPrice = minPriceRaw != null ? decimalToCents(minPriceRaw) : undefined;
  const maxPrice = maxPriceRaw != null ? decimalToCents(maxPriceRaw) : undefined;
  const brandId = searchParams.getAll("brandId");

  try {
    const repo = productRepository(ctx);
    const counts = await repo.getFilterCounts({
      search,
      status,
      minPrice,
      maxPrice,
      brandId,
    });
    return NextResponse.json(counts);
  } catch (error) {
    console.error("[/api/admin/products/counts] failed", error);
    return NextResponse.json(
      { error: "Failed to load counts" },
      { status: 500 },
    );
  }
}
