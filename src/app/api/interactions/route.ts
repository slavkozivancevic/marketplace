import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { z } from "zod";
import { recordInteraction } from "@/features/interactions/db/interactions";
import { resolveInteractionIdentity } from "@/features/interactions/identity";

const bodySchema = z.object({
  type: z.enum(["VIEW", "ADD_TO_CART"]),
  productId: z.string().min(1),
});

/**
 * Records a client-side engagement event (product view / add-to-cart). Fire-and-
 * forget from the browser; resolves identity (signed-in user or anonymous
 * visitor cookie), records best-effort, and always returns 204 so the client
 * never has to handle a failure.
 */
export async function POST(req: NextRequest) {
  await connection();

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const identity = await resolveInteractionIdentity({ allowSet: true });
  await recordInteraction({
    type: parsed.data.type,
    productId: parsed.data.productId,
    identity,
  });

  return new NextResponse(null, { status: 204 });
}
