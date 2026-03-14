import { prisma } from "@/core/db/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const users = await prisma.user.findMany();

  return NextResponse.json({
    success: true,
    count: users.length,
    users,
  });
}
