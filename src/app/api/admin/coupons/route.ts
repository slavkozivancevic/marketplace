import { logger } from "@/lib/logger";
import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { getCouponsPage } from "@/features/coupons/db/coupons";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";

/** Cursor-paginated coupon list. ADMIN only (mirrors the /admin/coupons gate). */
export async function GET(req: NextRequest) {
  await connection();

  let ctx;
  try {
    ctx = await resolveRequestContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (ctx.userRole !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const take = Math.min(Math.max(Number(searchParams.get("take") ?? LIST_PAGE_SIZE), 1), 100);
  const cursor = searchParams.get("cursor") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const statusParam = searchParams.get("status");
  const status = statusParam === "active" || statusParam === "inactive" ? statusParam : undefined;
  const sortBy = searchParams.get("sortBy") === "code" ? "code" : "createdAt";
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

  try {
    const result = await getCouponsPage({ take, cursor, search, status, sortBy, sortOrder });
    return NextResponse.json(result);
  } catch (error) {
    logger.error("[/api/admin/coupons] failed", error);
    return NextResponse.json({ error: "Failed to load coupons" }, { status: 500 });
  }
}
