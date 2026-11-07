import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env/server";
import { prisma } from "@/core/db/prisma";

/**
 * GET /api/internal/user-profiles?ids=id1,id2,...
 *
 * Internal-only endpoint called by AWS Lambdas (e.g. conversation-search processEvent).
 * Protected by x-api-key. Returns user names keyed by internal user ID.
 *
 * A deleted account comes back as `{ name: null, deleted: true }`: its name is
 * not kept anywhere, so a search index built from this never makes it
 * findable again (it used to get the English placeholder "Deleted User").
 */
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== env.CONVERSATION_SEARCH_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idsParam = request.nextUrl.searchParams.get("ids");
  if (!idsParam?.trim()) return NextResponse.json({ profiles: {} });

  const ids = idsParam.split(",").map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ profiles: {} });

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, deletedAt: true },
  });

  const profiles = Object.fromEntries(
    users.map((u) => {
      const deleted = u.deletedAt !== null;
      return [u.id, { name: deleted ? null : u.name, deleted }];
    })
  );

  return NextResponse.json({ profiles });
}
