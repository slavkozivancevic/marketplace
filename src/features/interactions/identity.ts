import "server-only";
import { safeAuth } from "@/lib/auth/safeAuth";
import { cookies } from "next/headers";
import { prisma } from "@/core/db/prisma";
import type { InteractionIdentity } from "./db/interactions";

/** Anonymous-visitor cookie. httpOnly so it's a server-only correlation id, not
 *  something client JS can read or spoof. */
const VISITOR_COOKIE = "mp_vid";
const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Resolves who is interacting: the signed-in user (DB id) when available, and an
 * anonymous visitor id from the `mp_vid` cookie. With `allowSet`, a missing
 * visitor cookie is minted (write endpoints) - reads pass `allowSet: false`.
 */
export async function resolveInteractionIdentity({
  allowSet,
}: {
  allowSet: boolean;
}): Promise<InteractionIdentity> {
  let userId: string | undefined;
  const { userId: clerkId } = await safeAuth();
  if (clerkId) {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: clerkId },
      select: { id: true },
    });
    userId = user?.id;
  }

  const jar = await cookies();
  let sessionId = jar.get(VISITOR_COOKIE)?.value;
  if (!sessionId && allowSet) {
    sessionId = crypto.randomUUID();
    jar.set(VISITOR_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: ONE_YEAR,
      path: "/",
    });
  }

  return { userId, sessionId };
}
