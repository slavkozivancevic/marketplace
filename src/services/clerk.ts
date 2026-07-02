import { logger } from "@/lib/logger";
import { clerkClient } from "@clerk/nextjs/server";
import { UserRole } from "@/generated/prisma/client";

export async function syncClerkUserMetadata({
  clerkUserId,
  dbId,
  role,
  activeOrgId,
}: {
  clerkUserId: string;
  dbId: string;
  role: UserRole;
  activeOrgId: string;
}) {
  if (!activeOrgId) {
    throw new Error("activeOrgId is required for Clerk metadata sync");
  }

  try {
    const client = await clerkClient();

    await client.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        dbId,
        role,
        activeOrgId,
      },
    });
  } catch (error) {
    // Clerk publicMetadata is only a cache of the DB source-of-truth, used to
    // populate the session JWT. A failed sync (e.g. Clerk 429 rate limit) must
    // not break the request - the DB-derived context is still valid, and the
    // next request retries once the token refreshes. So we log and swallow.
    logger.error("Clerk metadata sync failed (non-fatal):", error);
  }
}
