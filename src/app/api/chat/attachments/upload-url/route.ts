import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { getChatToken, refuseDemoChat } from "@/features/chat/server/chatToken";
import { rateLimitResponse } from "@/lib/rateLimit/guard";
import { env } from "@/env/server";
import axios from "axios";


export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveRequestContext();

    const limited = await rateLimitResponse("upload", ctx.userId);
    if (limited) return limited;

    const refused = refuseDemoChat(ctx);
    if (refused) return refused;
    const token = await getChatToken(ctx);
    const body = (await request.json().catch(() => null)) as unknown;

    const { data } = await axios.post<{ key: string; url: string }>(
      `${env.CHAT_HTTP_API_URL}/attachments/upload-url`,
      body,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return NextResponse.json(data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      return NextResponse.json(error.response.data, {
        status: error.response.status,
      });
    }
    logger.error("[upload-url] error:", error);
    return NextResponse.json(
      { error: "Failed to get upload URL" },
      { status: 500 },
    );
  }
}
