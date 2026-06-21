import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { getAuditLogsPage } from "@/features/audit/db/queries";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";

/** Cursor-paginated audit trail. ADMIN only (mirrors the /admin/audit page gate). */
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
  const take = Math.min(
    Math.max(Number(searchParams.get("take") ?? LIST_PAGE_SIZE), 1),
    100,
  );
  const cursor = searchParams.get("cursor") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const action = searchParams.get("action");
  const entityType = searchParams.get("entityType");

  try {
    const result = await getAuditLogsPage({
      take,
      cursor,
      search,
      action: action ? [action] : undefined,
      entityType: entityType ? [entityType] : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/admin/audit] failed", error);
    return NextResponse.json({ error: "Failed to load audit log" }, { status: 500 });
  }
}
