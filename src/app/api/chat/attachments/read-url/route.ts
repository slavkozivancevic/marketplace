import { NextRequest, NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { env } from "@/env/server";
import axios from "axios";

async function getChatToken(userId: string): Promise<string> {
  const { data } = await axios.post<{ token: string }>(
    `${env.CHAT_HTTP_API_URL}/auth/token`,
    { userId },
    { headers: { "x-api-key": env.CHAT_INTERNAL_API_KEY } }
  );
  return data.token;
}

export async function GET(request: NextRequest) {
  const ctx = await resolveRequestContext();
  if (!ctx.userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const key = new URL(request.url).searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const token = await getChatToken(ctx.userId);

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