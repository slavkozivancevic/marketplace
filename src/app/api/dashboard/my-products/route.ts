import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { productRepository } from "@/features/products/db/products";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { ProductStatus } from "@/generated/prisma/client";
import { GRID_PAGE_SIZE } from "@/constants/queryConstants";

const ALLOWED_SORTS = ["createdAt", "price", "title", "status"] as const;
type SortField = (typeof ALLOWED_SORTS)[number];

function parseSort(value: string | null): SortField | undefined {
  return ALLOWED_SORTS.includes(value as SortField)
    ? (value as SortField)
    : undefined;
}

export async function GET(req: NextRequest) {
  await connection();
  let ctx;
  try {
    ctx = await resolveRequestContext();
  } catch (e) {
    return NextResponse.json(handleActionError(e), { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const take = Math.min(
    Math.max(Number(searchParams.get("take") ?? GRID_PAGE_SIZE), 1),
    100,
  );
  const cursor = searchParams.get("cursor") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const sortBy = parseSort(searchParams.get("sortBy"));
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
  const status = searchParams
    .getAll("status")
    .filter((s): s is ProductStatus => Object.values(ProductStatus).includes(s as ProductStatus));

  try {
    const repo = productRepository(ctx);
    const result = await repo.getAll({
      take,
      cursor,
      search,
      sortBy,
      sortOrder,
      status,
    });

    return NextResponse.json({
      items: result.products.map((p) => ({
        ...p,
        price: Number(p.price),
        compareAtPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : null,
        costPrice: p.costPrice != null ? Number(p.costPrice) : null,
      })),
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    console.error("[/api/dashboard/my-products] failed", error);
    return NextResponse.json(
      { error: "Failed to load products" },
      { status: 500 },
    );
  }
}