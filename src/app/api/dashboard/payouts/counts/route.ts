import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { getOrgPayoutFacetCounts } from "@/features/payments/db/payouts";

/**
 * Disjunctive facet counts (status + refunded) for the payout list sidebar.
 * Mirrors the scope/search of `/api/dashboard/payouts`.
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
    requirePermission(ctx, "payout:manage");
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = req.nextUrl.searchParams.get("search") ?? undefined;

  try {
    const counts = await getOrgPayoutFacetCounts({
      organizationId: ctx.organizationId,
      search,
    });
    return NextResponse.json(counts);
  } catch (error) {
    console.error("[/api/dashboard/payouts/counts] failed", error);
    return NextResponse.json(
      { error: "Failed to load counts" },
      { status: 500 },
    );
  }
}
