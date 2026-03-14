import { NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { createPresignedUploadUrl } from "@/services/s3Upload";

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

    const { url, key } = await createPresignedUploadUrl(
      ctx.organizationId,
      contentType,
      size,
    );

    return NextResponse.json({ error: false, url, key });
  } catch (err: unknown) {
    return NextResponse.json(handleActionError(err), { status: 400 });
  }
}
