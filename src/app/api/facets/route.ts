import { logger } from "@/lib/logger";
import { decimalToCents } from "@/lib/currency";
import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import {
  getCategoryTree,
  getDescendantIds,
  getChainIds,
} from "@/features/categories/db/categories";
import { getCategoryFacets } from "@/features/attributes/db/facets";
import { parseAttrs } from "@/lib/query/attrs";

function parseOptionalFloat(value: string | null): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
}

export async function GET(req: NextRequest) {
  await connection();
  const { searchParams } = req.nextUrl;

  // No department = the global catalog (`/products`, `/brands/[slug]`): there
  // are no category-specific attribute facets, but brand / on-sale / type
  // counts are still computed against the whole result set.
  const dept = searchParams.get("dept") ?? "";

  const search = searchParams.get("search") ?? undefined;
  const searchLocale = searchParams.get("searchLocale") ?? undefined;
  const minPriceRaw = parseOptionalFloat(searchParams.get("minPrice"));
  const maxPriceRaw = parseOptionalFloat(searchParams.get("maxPrice"));
  const minPrice = minPriceRaw != null ? decimalToCents(minPriceRaw) : undefined;
  const maxPrice = maxPriceRaw != null ? decimalToCents(maxPriceRaw) : undefined;
  const onSaleParam = searchParams.get("onSale");
  const onSale = onSaleParam === "true" ? true : onSaleParam === "false" ? false : null;
  const bestsellerParam = searchParams.get("bestseller");
  const bestseller = bestsellerParam === "true" ? true : bestsellerParam === "false" ? false : null;
  const isDigitalParam = searchParams.get("isDigital");
  const isDigital = isDigitalParam === "true" ? true : isDigitalParam === "false" ? false : null;
  const minWarrantyRaw = searchParams.get("minWarranty");
  const minWarranty = minWarrantyRaw ? parseInt(minWarrantyRaw, 10) : undefined;
  const origin = searchParams.getAll("origin");
  const brandId = searchParams.getAll("brandId");
  const tagId = searchParams.getAll("tagId");
  const minRatingRaw = searchParams.get("minRating");
  const minRating = minRatingRaw ? parseInt(minRatingRaw, 10) : undefined;
  const attributeFilters = parseAttrs(searchParams.get("attrs"));

  try {
    const tree = await getCategoryTree();
    let deptDescendantIds: string[] = [];
    let chainIds: string[] = [];
    if (dept) {
      deptDescendantIds = getDescendantIds(tree, dept);
      chainIds = getChainIds(tree, dept);
      // A non-empty but unknown department slug scopes to nothing.
      if (deptDescendantIds.length === 0) {
        return NextResponse.json({
          facets: [],
          brandCounts: {},
          tagCounts: {},
          onSaleCount: 0,
          bestsellerCount: 0,
          isDigitalCounts: { true: 0, false: 0 },
          originCounts: {},
          warrantyCounts: {},
        });
      }
    }

    const result = await getCategoryFacets({
      deptDescendantIds,
      chainIds,
      base: {
        search,
        searchLocale,
        minPrice,
        maxPrice,
        onSale,
        bestseller,
        isDigital,
        minWarranty,
        origin,
        brandId,
        tagId,
        minRating,
      },
      attributeFilters,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("[/api/facets] failed", error);
    return NextResponse.json({ error: "Failed to load facets" }, { status: 500 });
  }
}
