import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/db/prisma";

/**
 * GET /api/chat/user-profiles?ids=id1,id2,...
 * Returns { [userId]: { name, imageUrl } } for each requested ID.
 * Used by chat UI to resolve participant IDs to display names/avatars.
 */
export async function GET(request: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ids = searchParams
    .get("ids")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? [];

  if (ids.length === 0) {
    return NextResponse.json({});
  }

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, imageUrl: true },
  });

  const profiles = Object.fromEntries(
    users.map((u) => [u.id, { name: u.name, imageUrl: u.imageUrl }])
  );

  return NextResponse.json(profiles);
}