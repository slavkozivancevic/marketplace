import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { validateAuthSync } from "./validateAuthSync";
import { prisma } from "@/core/db/prisma";
import { RequestContext } from "../../types/types";
import {
  MembershipNotFoundError,
  UnauthenticatedError,
} from "@/features/common/errors/domainErrors";

// Wrapped in React cache() so the many requireRole()/resolveRequestContext()
// calls within a single render (layout + page + nested components) share one
// result instead of each re-running auth(), DB lookups and the Clerk sync.
export const resolveRequestContext = cache(
  async (): Promise<RequestContext> => {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    throw new UnauthenticatedError();
  }

  const claims = sessionClaims as CustomJwtSessionClaims | undefined;

  let dbId = claims?.dbId;
  let activeOrgId = claims?.activeOrgId;

  const membership =
    dbId && activeOrgId
      ? await prisma.membership.findUnique({
          where: {
            userId_orgId: {
              userId: dbId,
              orgId: activeOrgId,
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
        })
      : null;

  const claimsOutOfSync =
    !dbId ||
    !activeOrgId ||
    !membership ||
    claims?.role !== membership.user.role;

  if (claimsOutOfSync) {
    const ctx = await validateAuthSync({
      clerkUserId: userId,
      dbId,
      activeOrgId,
      currentClaims: {
        dbId: claims?.dbId,
        role: claims?.role,
        activeOrgId: claims?.activeOrgId,
      },
    });

    dbId = ctx.dbId;
    activeOrgId = ctx.activeOrgId;

    const freshMembership = await prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId: dbId,
          orgId: activeOrgId,
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

    if (!freshMembership) {
      throw new MembershipNotFoundError();
    }

    return {
      clerkUserId: userId,
      userId: dbId,
      userRole: freshMembership.user.role,
      organizationId: activeOrgId,
      membershipRole: freshMembership.role,
      organizationVerified: freshMembership.organization.verified,
    };
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
);
