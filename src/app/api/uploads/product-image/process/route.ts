import { NextResponse } from "next/server";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { requirePermission } from "@/lib/auth/permissions";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { processImage } from "@/services/imageProcessor";

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

    const result = await processImage({ key });

    return NextResponse.json({ error: false, ...result });
  } catch (err: unknown) {
    return NextResponse.json(handleActionError(err), { status: 400 });
  }
}
