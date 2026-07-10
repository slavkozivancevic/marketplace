"use server";
import { logger } from "@/lib/logger";

import { getServerZodErrorMap } from "@/i18n/serverZodErrorMap";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { auth } from "@clerk/nextjs/server";
import {
  handleActionError,
  ForbiddenError,
  UnauthenticatedError,
} from "@/features/common/errors/domainErrors";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import { prisma } from "@/core/db/prisma";
import { syncClerkUserMetadata } from "@/services/clerk";
import { revalidateUserCache } from "@/features/users/db/cache";
import { createInvite, cancelInvite, acceptInvite, declineInvite } from "../db/invites";
import { getOrganizationById } from "../db/organizations";
import { publishInviteSent } from "@/services/notifications";
import { sendInviteSchema, SendInviteInput } from "../schema/invites";
import { ActionErrorResult } from "@/types/types";
import { env } from "@/env/server";
import { MembershipRole } from "@/generated/prisma/client";

export async function sendInviteAction(
  input: SendInviteInput,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = sendInviteSchema.safeParse(input, { error: await getServerZodErrorMap() });

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const ctx = await resolveRequestContext();

    if (
      ctx.membershipRole !== MembershipRole.OWNER &&
      ctx.membershipRole !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenError({ key: "onlyOwnersAndAdminsInvites" });
    }

    const organization = await getOrganizationById(ctx.organizationId);

    if (!organization) {
      const t = await getTranslations("actionErrors");
      return { error: true, message: t("organizationNotFound") };
    }

    const cookieStore = await cookies();
    const locale = cookieStore.get("NEXT_LOCALE")?.value ?? "en";

    // Normalize here too so the address we email matches the one persisted and
    // later compared against the accepting user's Clerk email.
    const email = parsed.data.email.trim().toLowerCase();

    const invite = await createInvite({
      email,
      orgId: ctx.organizationId,
      role: parsed.data.role,
      createdById: ctx.userId,
    });

    const inviteUrl = `${env.APP_URL}/${locale}/invite/${invite.token}`;

    // Fire-and-forget - notification failure must not block the invite creation
    publishInviteSent({
      token: invite.token,
      email,
      inviteUrl,
      organizationName: organization.name,
      role: parsed.data.role,
      locale,
    }).catch((err) => logger.error("[notifications] publishInviteSent failed", err));

    revalidatePath("/[locale]/dashboard/organization", "page");
  } catch (error) {
    logger.error("[sendInviteAction] error:", error);
    return handleActionError(error);
  }
}

export async function cancelInviteAction(
  inviteId: string,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();

    if (
      ctx.membershipRole !== MembershipRole.OWNER &&
      ctx.membershipRole !== MembershipRole.ADMIN
    ) {
      throw new ForbiddenError({ key: "onlyOwnersAndAdminsCancelInvites" });
    }

    await cancelInvite(inviteId, ctx.organizationId);

    revalidatePath("/[locale]/dashboard/organization", "page");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function acceptInviteAction(
  token: string,
): Promise<void | ActionErrorResult> {
  try {
    // Accepting an invite doesn't require an existing org context - resolve the
    // identity directly by the immutable Clerk id. This avoids the chicken/egg
    // where resolveRequestContext scopes to (and needs) an active org, and lets
    // us read the DB email to enforce the invite is claimed by the right person.
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      throw new UnauthenticatedError();
    }

    const dbUser = await prisma.user.findFirst({
      where: { clerkUserId, deletedAt: null },
      select: { id: true, email: true, role: true, clerkUserId: true },
    });

    if (!dbUser) {
      // The Clerk webhook provisions the DB user on sign-up. If Accept is
      // clicked before that lands (rare race), ask them to retry rather than
      // failing opaquely.
      const t = await getTranslations("actionErrors");
      return { error: true, message: t("accountSyncInProgress") };
    }

    const { orgId } = await acceptInvite(token, {
      id: dbUser.id,
      email: dbUser.email,
    });

    // acceptInvite already set activeOrgId in the DB; mirror it into Clerk
    // publicMetadata so the refreshed session token carries the new org and the
    // member lands scoped to it.
    await syncClerkUserMetadata({
      clerkUserId: dbUser.clerkUserId,
      dbId: dbUser.id,
      role: dbUser.role,
      activeOrgId: orgId,
    });

    revalidateUserCache(dbUser.id, dbUser.clerkUserId);
    revalidatePath("/[locale]/dashboard/organization", "page");
    revalidatePath("/[locale]/dashboard", "page");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function declineInviteAction(
  token: string,
): Promise<void | ActionErrorResult> {
  try {
    await declineInvite(token);

    revalidatePath('/[locale]/dashboard/organization', "page");
  } catch (error) {
    return handleActionError(error);
  }
}