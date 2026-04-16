import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { getPublicProductsPage } from "@/features/products/db/publicProducts";
import { GRID_PAGE_SIZE } from "@/constants/queryConstants";

const ALLOWED_SORTS = ["createdAt", "price", "title", "avgRating"] as const;
type SortField = (typeof ALLOWED_SORTS)[number];

function parseSort(value: string | null): SortField {
  return ALLOWED_SORTS.includes(value as SortField)
    ? (value as SortField)
    : "createdAt";
}

function parseOptionalFloat(value: string | null): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
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
  const minPrice = parseOptionalFloat(searchParams.get("minPrice"));
  const maxPrice = parseOptionalFloat(searchParams.get("maxPrice"));
  const onSaleParam = searchParams.get("onSale");
  const onSale = onSaleParam === "true" ? true : onSaleParam === "false" ? false : null;
  const isDigitalParam = searchParams.get("isDigital");
  const isDigital = isDigitalParam === "true" ? true : isDigitalParam === "false" ? false : null;

  try {
    const result = await getPublicProductsPage({
      take,
      cursor,
      search,
      sortBy,
      sortOrder,
      minPrice,
      maxPrice,
      onSale,
      isDigital,
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