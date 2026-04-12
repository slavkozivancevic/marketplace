import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { getPublicProductsPage } from "@/features/products/db/publicProducts";
import { GRID_PAGE_SIZE } from "@/constants/queryConstants";

const ALLOWED_SORTS = ["createdAt", "price", "title"] as const;
type SortField = (typeof ALLOWED_SORTS)[number];

function parseSort(value: string | null): SortField {
  return ALLOWED_SORTS.includes(value as SortField)
    ? (value as SortField)
    : "createdAt";
}

export async function GET(req: NextRequest) {
  await connection();
  const { searchParams } = req.nextUrl;

  const take = Math.min(
    Math.max(Number(searchParams.get("take") ?? GRID_PAGE_SIZE), 1),
    100,
  );
  const cursor = searchParams.get("cursor") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const sortBy = parseSort(searchParams.get("sortBy"));
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

  try {
    const result = await getPublicProductsPage({
      take,
      cursor,
      search,
      sortBy,
      sortOrder,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/products] failed", error);
    return NextResponse.json(
      { error: "Failed to load products" },
      { status: 500 },
    );
  }
}
