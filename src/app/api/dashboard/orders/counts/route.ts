import { logger } from "@/lib/logger";
import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";
import { getUserOrderStatusCounts } from "@/features/orders/db/orders";

/**
 * Disjunctive status counts for the buyer's order list sidebar. Mirrors the
 * scope/search of `/api/dashboard/orders`.
 */
export async function GET(req: NextRequest) {
  await connection();
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const search = req.nextUrl.searchParams.get("search") ?? undefined;

  try {
    const counts = await getUserOrderStatusCounts({ userId: user.id, search });
    return NextResponse.json({ status: counts });
  } catch (error) {
    logger.error("[/api/dashboard/orders/counts] failed", error);
    return NextResponse.json(
      { error: "Failed to load counts" },
      { status: 500 },
    );
  }
}
