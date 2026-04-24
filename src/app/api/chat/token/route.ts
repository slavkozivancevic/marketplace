import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { env } from "@/env/server";

/**
 * POST /api/chat/token
 *
 * Exchanges the Clerk session for a short-lived chat JWT.
 * Called client-side once on mount — token is stored in memory, never in localStorage.
 */
export async function POST() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  // Resolve the internal DB userId from the Clerk session
  const ctx = await resolveRequestContext();

  const response = await fetch(`${env.CHAT_HTTP_API_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.CHAT_INTERNAL_API_KEY,
    },
    body: JSON.stringify({ userId: ctx.userId }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to issue token" }, { status: 500 });
  }

  const data = await response.json() as { token: string };
  // Return userId alongside the token so the client knows which messages are "mine"
  return NextResponse.json({ token: data.token, userId: ctx.userId });
}