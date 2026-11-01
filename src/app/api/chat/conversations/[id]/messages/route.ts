import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { getChatToken, refuseDemoChat } from "@/features/chat/server/chatToken";
import { env } from "@/env/server";
import axios from "axios";


export async function GET(
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

  const { searchParams } = new URL(request.url);
  const upstreamParams = new URLSearchParams();
  if (searchParams.get("cursor")) upstreamParams.set("cursor", searchParams.get("cursor")!);
  if (searchParams.get("limit")) upstreamParams.set("limit", searchParams.get("limit")!);

  try {
    const { data } = await axios.get(
      `${env.CHAT_HTTP_API_URL}/conversations/${id}/messages?${upstreamParams}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return NextResponse.json(data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return NextResponse.json(error.response.data, { status: error.response.status });
    }
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}