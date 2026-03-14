import { auth } from "@clerk/nextjs/server";
import { validateAuthSync } from "./validateAuthSync";
import { prisma } from "@/core/db/prisma";
import { RequestContext } from "../../types/types";
import {
  MembershipNotFoundError,
  UnauthenticatedError,
} from "@/features/common/errors/domainErrors";

export async function resolveRequestContext(): Promise<RequestContext> {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    throw new UnauthenticatedError();
  }

  const claims = sessionClaims as CustomJwtSessionClaims | undefined;

  let dbId = claims?.dbId;
  let activeOrgId = claims?.activeOrgId;

  if (!dbId || !activeOrgId) {
    const ctx = await validateAuthSync({
      clerkUserId: userId,
      dbId,
      activeOrgId,
    });

    dbId = ctx.dbId;
    activeOrgId = ctx.activeOrgId;
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_orgId: {
        userId: dbId!,
        orgId: activeOrgId!,
      },
    },
    select: {
      role: true,
      organization: {
        select: {
          verified: true,
        },
      },
      user: {
        select: {
          role: true,
        },
      },
    },
  });

  if (!membership) {
    throw new MembershipNotFoundError();
  }

  return {
    clerkUserId: userId,
    userId: dbId!,
    userRole: membership.user.role,

    organizationId: activeOrgId!,
    membershipRole: membership.role,

    organizationVerified: membership.organization.verified,
  };
}
