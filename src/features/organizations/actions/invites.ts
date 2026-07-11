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
import { recordAudit } from "@/features/audit/db/audit";
import { createInvite, cancelInvite, acceptInvite, declineInvite } from "../db/invites";
import { getOrganizationById } from "../db/organizations";
import {
  publishInviteSent,
  publishInviteAccepted,
  publishInviteDeclined,
} from "@/services/notifications";
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
      select: { id: true, email: true, name: true, role: true, clerkUserId: true },
    });

    if (!dbUser) {
      // The Clerk webhook provisions the DB user on sign-up. If Accept is
      // clicked before that lands (rare race), ask them to retry rather than
      // failing opaquely.
      const t = await getTranslations("actionErrors");
      return { error: true, message: t("accountSyncInProgress") };
    }

    const result = await acceptInvite(token, {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
    });

    // acceptInvite already set activeOrgId in the DB; mirror it into Clerk
    // publicMetadata so the refreshed session token carries the new org and the
    // member lands scoped to it.
    await syncClerkUserMetadata({
      clerkUserId: dbUser.clerkUserId,
      dbId: dbUser.id,
      role: dbUser.role,
      activeOrgId: result.orgId,
    });

    await recordAudit({
      action: "member.invite_accepted",
      entityType: "Membership",
      entityId: dbUser.id,
      diff: { role: result.role, member: dbUser.email },
      // The acting user is the person accepting; scope the entry to the org they
      // joined (their request context still points at their previous active org).
      actor: { actorId: dbUser.id, actorEmail: dbUser.email, orgId: result.orgId },
    });

    // Confirmation + security signal to the inviter, in the inviter's locale.
    publishInviteAccepted({
      token,
      inviterEmail: result.inviter.email,
      inviterName: result.inviter.name,
      memberEmail: result.member.email,
      memberName: result.member.name,
      organizationName: result.organizationName,
      role: result.role,
      locale: result.inviter.locale,
    }).catch((err) =>
      logger.error("[notifications] publishInviteAccepted failed", err),
    );

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
    const result = await declineInvite(token);

    // Only audit/notify on the real PENDING -> CANCELED transition, so a repeat
    // decline (or a page reload) can't double-fire.
    if (result.wasPending) {
      await recordAudit({
        action: "member.invite_declined",
        entityType: "Invite",
        entityId: result.id,
        diff: { email: result.invitedEmail, role: result.role },
        // The decliner may not have an account; best-effort actor is the invited
        // email, scoped to the inviting org.
        actor: { actorId: null, actorEmail: result.invitedEmail, orgId: result.orgId },
      });

      publishInviteDeclined({
        token,
        inviterEmail: result.inviter.email,
        inviterName: result.inviter.name,
        invitedEmail: result.invitedEmail,
        organizationName: result.organizationName,
        role: result.role,
        locale: result.inviter.locale,
      }).catch((err) =>
        logger.error("[notifications] publishInviteDeclined failed", err),
      );
    }

    revalidatePath('/[locale]/dashboard/organization', "page");
  } catch (error) {
    return handleActionError(error);
  }
}