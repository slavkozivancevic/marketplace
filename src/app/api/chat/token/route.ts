import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { getChatToken, refuseDemoChat } from "@/features/chat/server/chatToken";

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
  const refused = refuseDemoChat(ctx);
  if (refused) return refused;

  try {
    const token = await getChatToken(ctx);
    return NextResponse.json({ token, userId: ctx.userId });
  } catch {
    return NextResponse.json({ error: "Failed to issue token" }, { status: 500 });
  }
}