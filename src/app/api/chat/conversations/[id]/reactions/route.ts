import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { getChatToken, refuseDemoChat } from "@/features/chat/server/chatToken";
import { env } from "@/env/server";
import axios from "axios";


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const ctx = await resolveRequestContext();
  const refused = refuseDemoChat(ctx);
  if (refused) return refused;
  const token = await getChatToken(ctx);
  const { id } = await params;

  try {
    const { data } = await axios.get(
      `${env.CHAT_HTTP_API_URL}/conversations/${id}/reactions`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return NextResponse.json(data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return NextResponse.json(error.response.data, { status: error.response.status });
    }
    return NextResponse.json({ error: "Failed to fetch reactions" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const ctx = await resolveRequestContext();
  const refused = refuseDemoChat(ctx);
  if (refused) return refused;
  const token = await getChatToken(ctx);
  const { id } = await params;
  const body = await request.json() as unknown;

  try {
    const { data } = await axios.post(
      `${env.CHAT_HTTP_API_URL}/conversations/${id}/reactions`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return NextResponse.json(data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return NextResponse.json(error.response.data, { status: error.response.status });
    }
    return NextResponse.json({ error: "Failed to toggle reaction" }, { status: 500 });
  }
}