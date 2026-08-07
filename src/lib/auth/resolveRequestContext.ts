import { cache } from "react";
import { safeAuth } from "./safeAuth";
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
  const { userId, sessionClaims } = await safeAuth();

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
                // The DB is the source of truth for the active org. We read it
                // here to detect a just-switched session whose JWT still names
                // the previous org (the claim lags a token refresh).
                activeOrgId: true,
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

  // Claims are valid for `activeOrgId`, but the DB may name a different active
  // org - this happens in the brief window right after an org switch, before
  // the session token refreshes to carry the new claim. Trust the DB and
  // re-scope to it so data updates immediately. No Clerk write here: the switch
  // action already synced publicMetadata and the client refreshes the token, so
  // re-syncing on every request would just hammer Clerk's write rate limit.
  const dbActiveOrgId = membership.user.activeOrgId;
  if (dbActiveOrgId && dbActiveOrgId !== activeOrgId) {
    const dbMembership = await prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId: dbId!,
          orgId: dbActiveOrgId,
        },
      },
      select: {
        role: true,
        organization: { select: { verified: true } },
        user: { select: { role: true } },
      },
    });

    if (dbMembership) {
      return {
        clerkUserId: userId,
        userId: dbId!,
        userRole: dbMembership.user.role,
        organizationId: dbActiveOrgId,
        membershipRole: dbMembership.role,
        organizationVerified: dbMembership.organization.verified,
      };
    }
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
