import { NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { processVideo } from "@/services/videoProcessor";

// 50MB videos can take a few seconds to probe + extract a frame; bump from
// the platform default to give ffmpeg headroom on the slow path.
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const ctx = await resolveRequestContext();

    requirePermission(ctx, "product:create");

    const { key }: { key: string } = await req.json();
    if (!key) {
      return NextResponse.json(
        { error: true, message: "Missing key" },
        { status: 400 },
      );
    }

    const expectedPrefix = `orgs/${ctx.organizationId}/products/`;
    if (!key.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: true, message: "Forbidden" },
        { status: 403 },
      );
    }

    const result = await processVideo({ key });

    return NextResponse.json({ error: false, data: result });
  } catch (err: unknown) {
    return NextResponse.json(handleActionError(err), { status: 400 });
  }
}