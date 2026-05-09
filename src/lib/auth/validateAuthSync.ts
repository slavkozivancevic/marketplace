import { prisma } from "@/core/db/prisma";
import { syncClerkUserMetadata } from "@/services/clerk";

export async function validateAuthSync({
  clerkUserId,
  dbId,
}: {
  clerkUserId: string;
  dbId?: string;
  activeOrgId?: string;
}) {
  const user = await prisma.user.findFirst({
    where: dbId ? { id: dbId } : { clerkUserId },
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

  await syncClerkUserMetadata(context);

  return context;
}