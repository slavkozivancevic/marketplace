import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { deleteS3Object } from "@/services/s3Delete";
import { toEmailThumbKey } from "@/services/s3Copy";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { rateLimitResponse } from "@/lib/rateLimit/guard";

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:delete");

    const limited = await rateLimitResponse("upload", ctx.userId);
    if (limited) return limited;

    const { key } = await request.json();

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: true, message: "Invalid key" }, { status: 400 });
    }

    // Ensure the key belongs to the authenticated user's organization.
    // Key format: orgs/{organizationId}/products/{uuid}
    const expectedPrefix = `orgs/${ctx.organizationId}/products/`;
    if (!key.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: true, message: "Forbidden" }, { status: 403 });
    }

    // Delete original
    await deleteS3Object(key);

    // Delete thumbnail
    const thumbKey = key.replace("/products/", "/products/thumbs/") + ".webp";
    await deleteS3Object(thumbKey);

    // Delete the email JPEG derivative if one was ever generated (best-effort).
    await deleteS3Object(toEmailThumbKey(key)).catch(() => {});

    return NextResponse.json({ error: false });
  } catch (error) {
    logger.error("Delete error:", error);
    return NextResponse.json(await handleActionError(error), { status: 400 });
  }
}