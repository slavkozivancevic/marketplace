import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { safeAuth } from "@/lib/auth/safeAuth";
import { rateLimitResponse, getClientIp } from "@/lib/rateLimit/guard";

const MAX_BODY_BYTES = 32 * 1024;

const requestSchema = z.object({
  kind: z.enum(["nav", "prefetch", "action"]),
  url: z.string().max(400),
  segment: z.string().max(200).optional(),
  start: z.number(),
  status: z.number().optional(),
  headersAt: z.number().optional(),
  failedAt: z.number().optional(),
  error: z.string().max(200).optional(),
});

const bodySchema = z.object({
  reason: z.string().max(40),
  target: z.string().max(400),
  here: z.string().max(400),
  waitedMs: z.number(),
  pageAgeMs: z.number(),
  visibility: z.string().max(20),
  online: z.boolean(),
  buildId: z.string().max(80).nullable(),
  nextVersion: z.string().max(40).nullable(),
  clerk: z
    .object({
      loaded: z.boolean(),
      sessionId: z.string().max(80).nullable(),
      sessionStatus: z.string().max(40).nullable(),
      userId: z.string().max(80).nullable(),
    })
    .nullable(),
  requests: z.array(requestSchema).max(60),
});

/**
 * POST /api/diagnostics/nav
 *
 * Receives the browser's report of a soft navigation that never finished (see
 * `src/lib/navigation/navDiagnostics.ts`) and writes it to the logs as
 * `nav_stuck`, so the cause can be read from CloudWatch the next time it
 * happens - it has never reproduced on demand. Fire-and-forget: always 204.
 */
export async function POST(req: NextRequest) {
  await connection();

  const limited = await rateLimitResponse("diagnostics", await getClientIp());
  if (limited) return limited;

  const text = await req.text().catch(() => "");
  if (!text || text.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 204 });

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return new NextResponse(null, { status: 204 });

  const { userId } = await safeAuth();
  const { requests, clerk, ...fields } = parsed.data;
  // Flat fields, so Logs Insights can filter on them; the request timeline is
  // one JSON string - it is read, not queried.
  logger.warn("nav_stuck", {
    ...fields,
    serverUserId: userId ?? null,
    clerkLoaded: clerk?.loaded ?? null,
    clerkSessionId: clerk?.sessionId ?? null,
    clerkSessionStatus: clerk?.sessionStatus ?? null,
    clerkUserId: clerk?.userId ?? null,
    userAgent: (req.headers.get("user-agent") ?? "").slice(0, 200),
    requestCount: requests.length,
    requests: JSON.stringify(requests),
  });

  return new NextResponse(null, { status: 204 });
}
