import { NextResponse } from "next/server";
import { prisma } from "@/core/db/prisma";

// Always live - health/readiness must reflect the current state, never a cache.
export const dynamic = "force-dynamic";

/**
 * Health / readiness probe for load balancers and uptime monitors. Verifies DB
 * connectivity and returns 200 when healthy, 503 when the database is
 * unreachable (so an orchestrator can pull the instance out of rotation).
 * Public, unauthenticated, and intentionally cheap.
 */
export async function GET() {
  const startedAt = Date.now();
  let db: "up" | "down" = "up";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "down";
  }

  const healthy = db === "up";
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      db,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
