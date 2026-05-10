import { decimalToCents } from "@/lib/currency";
import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { productRepository } from "@/features/products/db/products";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { ProductStatus } from "@/generated/prisma/client";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";

const ALLOWED_SORTS = ["createdAt", "price", "title", "status"] as const;
type SortField = (typeof ALLOWED_SORTS)[number];

function parseSort(value: string | null): SortField | undefined {
  return ALLOWED_SORTS.includes(value as SortField)
    ? (value as SortField)
    : undefined;
}

function parseOptionalFloat(value: string | null): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
}

export async function GET(req: NextRequest) {
  await connection();
  let ctx;
  try {
    ctx = await resolveRequestContext();
    requirePermission(ctx, "product:read");
  } catch (e) {
    return NextResponse.json(handleActionError(e), { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const take = Math.min(
    Math.max(Number(searchParams.get("take") ?? LIST_PAGE_SIZE), 1),
    100,
  );
  const cursor = searchParams.get("cursor") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const sortBy = parseSort(searchParams.get("sortBy"));
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
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
    const result = await repo.getAll({
      take,
      cursor,
      search,
      sortBy,
      sortOrder,
      status,
      minPrice,
      maxPrice,
      brandId,
    });

    return NextResponse.json({
      items: result.products.map((p) => ({
        ...p,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        costPrice: p.costPrice,
      })),
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    console.error("[/api/admin/products] failed", error);
    return NextResponse.json(
      { error: "Failed to load products" },
      { status: 500 },
    );
  }
}