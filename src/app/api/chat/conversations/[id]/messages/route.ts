import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { env } from "@/env/server";

async function getChatToken(userId: string): Promise<string> {
  const res = await fetch(`${env.CHAT_HTTP_API_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.CHAT_INTERNAL_API_KEY,
    },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error("Failed to issue chat token");
  const data = await res.json() as { token: string };
  return data.token;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const ctx = await resolveRequestContext();
  const token = await getChatToken(ctx.userId);
  const { id } = await params;

  const { searchParams } = new URL(request.url);
  const upstreamParams = new URLSearchParams();
  if (searchParams.get("cursor")) upstreamParams.set("cursor", searchParams.get("cursor")!);
  if (searchParams.get("limit")) upstreamParams.set("limit", searchParams.get("limit")!);

  const upstream = await fetch(
    `${env.CHAT_HTTP_API_URL}/conversations/${id}/messages?${upstreamParams}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
