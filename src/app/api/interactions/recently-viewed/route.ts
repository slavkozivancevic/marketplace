import { NextResponse, type NextRequest } from "next/server";
import { connection } from "next/server";
import { getRecentlyViewed } from "@/features/interactions/db/interactions";
import { resolveInteractionIdentity } from "@/features/interactions/identity";

/**
 * Recently viewed products for the current visitor (signed-in user or anonymous
 * cookie), newest first, excluding `?exclude=<productId>`. Personalized, so it's
 * served live (never cached) and fetched client-side - keeping the product page
 * itself cacheable.
 */
export async function GET(req: NextRequest) {
  await connection();

  const exclude = req.nextUrl.searchParams.get("exclude") ?? undefined;
  const identity = await resolveInteractionIdentity({ allowSet: false });
  const products = await getRecentlyViewed({ identity, excludeProductId: exclude });

  return NextResponse.json({ products });
}
