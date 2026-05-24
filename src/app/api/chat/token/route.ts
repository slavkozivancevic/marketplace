import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { env } from "@/env/server";
import axios from "axios";

/**
 * POST /api/chat/token
 *
 * Exchanges the Clerk session for a short-lived chat JWT.
 * Called client-side once on mount - token is stored in memory, never in localStorage.
 */
export async function POST() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const ctx = await resolveRequestContext();

  try {
    const { data } = await axios.post<{ token: string }>(
      `${env.CHAT_HTTP_API_URL}/auth/token`,
      { userId: ctx.userId },
      { headers: { "x-api-key": env.CHAT_INTERNAL_API_KEY } }
    );
    return NextResponse.json({ token: data.token, userId: ctx.userId });
  } catch {
    return NextResponse.json({ error: "Failed to issue token" }, { status: 500 });
  }
}