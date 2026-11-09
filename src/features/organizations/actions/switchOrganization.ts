"use server";

import {
  handleActionError,
  ForbiddenError,
} from "@/features/common/errors/domainErrors";
import { resolveRequestContextAnyOrg } from "@/lib/auth/resolveRequestContext";
import { syncClerkUserMetadata } from "@/services/clerk";
import { refreshOwnUserCache } from "@/features/users/db/cache";
import { revalidateOrganizationCache } from "@/features/organizations/db/cache";
import { switchActiveOrg } from "@/features/users/db/users";
import { prisma } from "@/core/db/prisma";
import { ActionErrorResult } from "@/types/types";

export async function switchOrganizationAction(
  targetOrgId: string,
): Promise<void | ActionErrorResult> {
  try {
    // AnyOrg: a tab still showing an org that was switched away elsewhere must
    // be able to switch too - it is the way out, not a write into that org.
    const ctx = await resolveRequestContextAnyOrg();

    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId: ctx.userId,
          orgId: targetOrgId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenError({ key: "notMemberOfOrganization" });
    }

    await switchActiveOrg(ctx.userId, targetOrgId);

    await syncClerkUserMetadata({
      clerkUserId: ctx.clerkUserId,
      dbId: ctx.userId,
      role: ctx.userRole,
      activeOrgId: targetOrgId,
    });

    // updateTag, not only revalidateTag: the refresh that follows must render
    // the shell with the new org - see refreshOwnUserCache.
    refreshOwnUserCache(ctx.userId, ctx.clerkUserId);
    revalidateOrganizationCache(targetOrgId);
  } catch (error) {
    return handleActionError(error);
  }

  // No redirect: the client (OrganizationSwitcher) refreshes the session token
  // and re-renders the current route in place, so the user stays on the page
  // they switched from with data re-scoped to the new org.
}
