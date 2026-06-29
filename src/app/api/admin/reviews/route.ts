import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { getReviewsPage } from "@/features/reviews/db/adminQueries";
import { LIST_PAGE_SIZE } from "@/constants/queryConstants";
import type { ReviewStatus } from "@/generated/prisma/client";

const STATUSES: ReviewStatus[] = ["PENDING", "APPROVED", "REJECTED"];

/** Cursor-paginated review moderation queue. ADMIN only. */
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
  const statusParam = searchParams.get("status");
  const status = STATUSES.includes(statusParam as ReviewStatus)
    ? (statusParam as ReviewStatus)
    : undefined;
  const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

  try {
    const result = await getReviewsPage({ take, cursor, search, status, sortOrder });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/admin/reviews] failed", error);
    return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
  }
}
