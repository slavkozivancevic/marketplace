import { NextRequest, NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { getChatToken, refuseDemoChat } from "@/features/chat/server/chatToken";
import { env } from "@/env/server";
import axios from "axios";


export async function GET(request: NextRequest) {
  const ctx = await resolveRequestContext();
  if (!ctx.userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const key = new URL(request.url).searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const refused = refuseDemoChat(ctx);
  if (refused) return refused;
  const token = await getChatToken(ctx);

  try {
    const { data } = await axios.get<{ url: string }>(
      `${env.CHAT_HTTP_API_URL}/attachments/read-url?key=${encodeURIComponent(key)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return NextResponse.json(data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return NextResponse.json(error.response.data, { status: error.response.status });
    }
    return NextResponse.json({ error: "Failed to get read URL" }, { status: 500 });
  }
}