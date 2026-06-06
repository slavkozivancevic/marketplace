import { decimalToCents } from "@/lib/currency";
import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { getPublicProductsPage } from "@/features/products/db/publicProducts";
import { getCategoryTree, getDescendantIds } from "@/features/categories/db/categories";
import { GRID_PAGE_SIZE } from "@/constants/queryConstants";
import { parseAttrs } from "@/lib/query/attrs";

const ALLOWED_SORTS = ["createdAt", "price", "avgRating"] as const;
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
  const minPriceRaw = parseOptionalFloat(searchParams.get("minPrice"));
  const maxPriceRaw = parseOptionalFloat(searchParams.get("maxPrice"));
  const minPrice = minPriceRaw != null ? decimalToCents(minPriceRaw) : undefined;
  const maxPrice = maxPriceRaw != null ? decimalToCents(maxPriceRaw) : undefined;
  const onSaleParam = searchParams.get("onSale");
  const onSale = onSaleParam === "true" ? true : onSaleParam === "false" ? false : null;
  const isDigitalParam = searchParams.get("isDigital");
  const isDigital = isDigitalParam === "true" ? true : isDigitalParam === "false" ? false : null;
  const brandId = searchParams.getAll("brandId");
  const minRatingRaw = searchParams.get("minRating");
  const minRating = minRatingRaw ? parseInt(minRatingRaw, 10) : undefined;
  const dept = searchParams.get("dept") ?? "";
  const attributeFilters = parseAttrs(searchParams.get("attrs"));

  // Resolve department slug → all descendant category IDs
  let categoryId: string[] | undefined;
  if (dept) {
    const tree = await getCategoryTree();
    const ids = getDescendantIds(tree, dept);
    categoryId = ids.length ? ids : ["__no_match__"]; // empty dept = no results
  }

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
      brandId,
      minRating,
      categoryId,
      attributeFilters,
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