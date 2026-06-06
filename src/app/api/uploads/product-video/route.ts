import { NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { createPresignedVideoUploadUrl } from "@/services/s3Upload";

export async function POST(req: Request) {
  try {
    const ctx = await resolveRequestContext();

    requirePermission(ctx, "product:create");

    const { contentType, size }: { contentType: string; size: number } =
      await req.json();
    if (!contentType || !size) {
      return NextResponse.json(
        { error: true, message: "Missing contentType or size" },
        { status: 400 },
      );
    }

    const { key, url } = await createPresignedVideoUploadUrl(
      ctx.organizationId,
      contentType,
      size,
    );

    return NextResponse.json({ error: false, data: { key, url } });
  } catch (err: unknown) {
    return NextResponse.json(await handleActionError(err), { status: 400 });
  }
}