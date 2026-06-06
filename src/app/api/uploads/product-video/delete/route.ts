import { NextRequest, NextResponse } from "next/server";
import { deleteS3Object } from "@/services/s3Delete";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { handleActionError } from "@/features/common/errors/domainErrors";

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveRequestContext();
    requirePermission(ctx, "product:delete");

    const { key } = await request.json();

    if (!key || typeof key !== "string") {
      return NextResponse.json(
        { error: true, message: "Invalid key" },
        { status: 400 },
      );
    }

    // Videos live under orgs/{org}/products/videos/{uuid} but the org-prefix
    // check is enough to scope deletes to the caller's organization.
    const expectedPrefix = `orgs/${ctx.organizationId}/products/`;
    if (!key.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: true, message: "Forbidden" },
        { status: 403 },
      );
    }

    await deleteS3Object(key);

    // Poster lives under the standard thumbs path.
    const thumbKey = key.replace("/products/", "/products/thumbs/") + ".webp";
    await deleteS3Object(thumbKey).catch(() => {});

    return NextResponse.json({ error: false });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(await handleActionError(error), { status: 400 });
  }
}