"use server";

import { redirect } from "next/navigation";
import {
  handleActionError,
  ForbiddenError,
} from "@/features/common/errors/domainErrors";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { syncClerkUserMetadata } from "@/services/clerk";
import { revalidateUserCache } from "@/features/users/db/cache";
import { revalidateOrganizationCache } from "@/features/organizations/db/cache";
import { switchActiveOrg } from "@/features/users/db/users";
import { prisma } from "@/core/db/prisma";
import { ActionErrorResult } from "@/types/types";

export async function switchOrganizationAction(
  targetOrgId: string,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();

    const membership = await prisma.membership.findUnique({
      where: {
        userId_orgId: {
          userId: ctx.userId,
          orgId: targetOrgId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenError("You are not a member of this organization");
    }

    await switchActiveOrg(ctx.userId, targetOrgId);

    await syncClerkUserMetadata({
      clerkUserId: ctx.clerkUserId,
      dbId: ctx.userId,
      role: ctx.userRole,
      activeOrgId: targetOrgId,
    });

    revalidateUserCache(ctx.userId, ctx.clerkUserId);
    revalidateOrganizationCache(targetOrgId);
  } catch (error) {
    return handleActionError(error);
  }

  redirect("/dashboard");
}
