import { logger } from "@/lib/logger";
import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { getOrgOrdersPage } from "@/features/orders/db/orgOrders";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";

const ALLOWED_SORTS = ["createdAt", "total"] as const;
type SortField = (typeof ALLOWED_SORTS)[number];

function parseSort(value: string | null): SortField {
  return ALLOWED_SORTS.includes(value as SortField)
    ? (value as SortField)
    : "createdAt";
}

export async function GET(req: NextRequest) {
  await connection();

  let ctx;
  try {
    ctx = await resolveRequestContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(ctx, "order:read");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  const statusParam = searchParams.get("status");
  const status = statusParam ? statusParam.split(",").filter(Boolean) : undefined;

  try {
    const result = await getOrgOrdersPage({
      organizationId: ctx.organizationId,
      take,
      cursor,
      search,
      status,
      sortBy,
      sortOrder,
    });
    return NextResponse.json(result);
  } catch (error) {
    logger.error("[/api/dashboard/org-orders] failed", error);
    return NextResponse.json(
      { error: "Failed to load orders" },
      { status: 500 },
    );
  }
}