import { prisma } from "@/core/db/prisma";
import { syncClerkUserMetadata } from "@/services/clerk";
import { UserRole } from "@/generated/prisma/client";

export async function validateAuthSync({
  clerkUserId,
  currentClaims,
}: {
  clerkUserId: string;
  dbId?: string;
  activeOrgId?: string;
  currentClaims?: {
    dbId?: string;
    role?: UserRole;
    activeOrgId?: string;
  };
}) {
  // Always resolve by the Clerk user id - the one reliable, immutable identity.
  // Trusting a `dbId` from the JWT breaks whenever that claim is stale: after a
  // DB reset, or when one Clerk instance is shared across environments (its
  // `dbId` points at a different DB's row). We re-sync the correct dbId to Clerk
  // below, so a stale claim self-heals on the next request.
  const user = await prisma.user.findFirst({
    where: { clerkUserId },
    include: { memberships: true },
  });

  if (!user || user.deletedAt) {
    throw new Error("User not found during auth sync");
  }

  if (user.memberships.length === 0) {
    throw new Error("User has no membership");
  }

  // Prefer the stored activeOrgId, but fall back to first membership
  // if the user was removed from that org since the last session sync.
  const preferredOrgId = user.activeOrgId;
  const membership =
    (preferredOrgId && user.memberships.find((m) => m.orgId === preferredOrgId)) ||
    user.memberships[0];

  const context = {
    clerkUserId,
    dbId: user.id,
    role: user.role,
    activeOrgId: membership.orgId,
  };

  // Only push to Clerk when the session token is actually stale. If the JWT
  // already carries the same dbId/role/activeOrgId, the metadata is in sync and
  // a write would be a redundant call against Clerk's (strict) write rate limit.
  const metadataInSync =
    currentClaims?.dbId === context.dbId &&
    currentClaims?.role === context.role &&
    currentClaims?.activeOrgId === context.activeOrgId;

  if (!metadataInSync) {
    await syncClerkUserMetadata(context);
  }

  return context;
}