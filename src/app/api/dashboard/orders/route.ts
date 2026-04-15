import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";
import { getUserOrdersPage } from "@/features/orders/db/orders";
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
    const result = await getUserOrdersPage({
      userId: user.id,
      take,
      cursor,
      search,
      status,
      sortBy,
      sortOrder,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[/api/dashboard/orders] failed", error);
    return NextResponse.json(
      { error: "Failed to load orders" },
      { status: 500 },
    );
  }
}