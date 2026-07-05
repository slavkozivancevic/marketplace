import { logger } from "@/lib/logger";
import { NextRequest, NextResponse, connection } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { env } from "@/env/server";
import axios from "axios";

async function getChatToken(userId: string): Promise<string> {
  const { data } = await axios.post<{ token: string }>(
    `${env.CHAT_HTTP_API_URL}/auth/token`,
    { userId },
    { headers: { "x-api-key": env.CHAT_INTERNAL_API_KEY } },
  );
  return data.token;
}

/**
 * GET /api/chat/attachments/content?key=…
 *
 * Fetches the S3 object server-side and streams it back as a same-origin
 * response. This is needed because the S3 bucket has no CORS configuration,
 * so browser XHR/fetch (used by PDF.js workers, video players, etc.) would
 * be blocked. <img> tags work without CORS but PDF.js needs to read the bytes.
 */
export async function GET(request: NextRequest) {
  // Opt out of prerendering: this handler reads auth/headers, but that dynamic
  // signal would be swallowed by the try/catch below. `connection()` marks it
  // dynamic explicitly (the cacheComponents-safe replacement for force-dynamic).
  await connection();
  try {
    const ctx = await resolveRequestContext();
    if (!ctx.userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const key = new URL(request.url).searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const token = await getChatToken(ctx.userId);

    const { data: urlData } = await axios.get<{ url: string }>(
      `${env.CHAT_HTTP_API_URL}/attachments/read-url?key=${encodeURIComponent(key)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    // Fetch from S3 on the server - no browser CORS constraints apply here
    const s3Res = await fetch(urlData.url);
    if (!s3Res.ok) {
      return NextResponse.json({ error: "Failed to fetch from S3" }, { status: s3Res.status });
    }

    const buffer = await s3Res.arrayBuffer();
    const contentType = s3Res.headers.get("Content-Type") ?? "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3000",
      },
    });
  } catch (error) {
    logger.error("[attachment-content]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}