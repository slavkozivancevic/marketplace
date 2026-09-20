import { prisma } from "@/core/db/prisma";
import { pickActiveMembership } from "@/features/organizations/db/activeOrg";
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

  // Prefer the stored activeOrgId, but fall back by standing (own org first)
  // if the user was removed from that org since the last session sync.
  const membership = pickActiveMembership(user.activeOrgId, user.memberships)!;

  // The fallback fired, so the stored pointer names an org this user is not in.
  // Write the correction back: every page that reads `User.activeOrgId` on its
  // own (the dashboard shell, my-products) trusts that column, and a pointer
  // left dangling there turns the owner of an org into a read-only guest in it.
  // Removal now repoints it in the same transaction, so this only catches rows
  // that were already broken - and heals them on first sight.
  //
  // No cache invalidation here on purpose: this runs during render as often as
  // in a Server Action, and `revalidateTag` is a mutation API that throws when
  // called while rendering. It is not needed either - the readers all resolve
  // the effective org through `pickActiveMembership`, so a cached user row
  // carrying the stale pointer still lands on the same organization.
  if (user.activeOrgId !== membership.orgId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { activeOrgId: membership.orgId },
    });
  }

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