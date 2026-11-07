import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { refuseDemoChat } from "@/features/chat/server/chatToken";
import { verifySearchResults, type SearchResult } from "@/features/chat/server/searchResults";
import { prisma } from "@/core/db/prisma";
import { env } from "@/env/server";
import axios from "axios";

export async function GET(request: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  const ctx = await resolveRequestContext();
  const refused = refuseDemoChat(ctx);
  if (refused) return refused;

  try {
    const { data } = await axios.get<{ results: SearchResult[] }>(
      `${env.CONVERSATION_SEARCH_API_URL}/search`,
      {
        params: { userId: ctx.userId, q },
        headers: { "x-api-key": env.CONVERSATION_SEARCH_API_KEY },
      }
    );

    // The index is a copy of names, updated by events; this database is the
    // truth. Check every hit against it before answering - see
    // verifySearchResults for what a stale copy got wrong.
    const otherIds = [...new Set(data.results.map((r) => r.otherUserId))];
    const users = otherIds.length
      ? await prisma.user.findMany({
          where: { id: { in: otherIds } },
          select: { id: true, name: true, deletedAt: true },
        })
      : [];
    const results = verifySearchResults(data.results, users, q);
    return NextResponse.json({ results });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return NextResponse.json(error.response.data, { status: error.response.status });
    }
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
