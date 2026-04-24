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

export async function GET(request: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const ctx = await resolveRequestContext();
  const token = await getChatToken(ctx.userId);

  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams();
  if (searchParams.get("cursor")) params.set("cursor", searchParams.get("cursor")!);
  if (searchParams.get("limit")) params.set("limit", searchParams.get("limit")!);

  const upstream = await fetch(
    `${env.CHAT_HTTP_API_URL}/conversations?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

export async function POST(request: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const ctx = await resolveRequestContext();
  const token = await getChatToken(ctx.userId);
  const body = await request.json();

  const upstream = await fetch(`${env.CHAT_HTTP_API_URL}/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
