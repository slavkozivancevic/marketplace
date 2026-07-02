import { logger } from "@/lib/logger";
import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { getOrgOrderStatusCounts } from "@/features/orders/db/orgOrders";

/**
 * Disjunctive status counts for the org order list sidebar. Mirrors the
 * scope/search of `/api/dashboard/org-orders`.
 */
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

  const search = req.nextUrl.searchParams.get("search") ?? undefined;

  try {
    const counts = await getOrgOrderStatusCounts({
      organizationId: ctx.organizationId,
      search,
    });
    return NextResponse.json({ status: counts });
  } catch (error) {
    logger.error("[/api/dashboard/org-orders/counts] failed", error);
    return NextResponse.json(
      { error: "Failed to load counts" },
      { status: 500 },
    );
  }
}
