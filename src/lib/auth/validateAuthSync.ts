import { prisma } from "@/core/db/prisma";
import { syncClerkUserMetadata } from "@/services/clerk";

export async function validateAuthSync({
  clerkUserId,
  dbId,
  activeOrgId,
}: {
  clerkUserId: string;
  dbId?: string;
  activeOrgId?: string;
}) {
  const user = await prisma.user.findFirst({
    where: dbId
      ? { id: dbId }
      : {
          clerkUserId,
        },
    include: {
      memberships: true,
    },
  });

  if (!user || user.deletedAt) {
    throw new Error("User not found during auth sync");
  }

  const membership = activeOrgId
    ? user.memberships.find((m) => m.orgId === activeOrgId)
    : user.memberships[0];

  if (!membership) {
    throw new Error("User has no membership");
  }

  const context = {
    clerkUserId,
    dbId: user.id,
    role: user.role,
    activeOrgId: membership.orgId,
  };

  await syncClerkUserMetadata(context);

  return context;
}
