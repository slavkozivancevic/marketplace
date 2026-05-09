"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  handleActionError,
  ForbiddenError,
} from "@/features/common/errors/domainErrors";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
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
    const parsed = sendInviteSchema.safeParse(input);

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
      throw new ForbiddenError("Only owners and admins can send invites");
    }

    const organization = await getOrganizationById(ctx.organizationId);

    if (!organization) {
      return { error: true, message: "Organization not found" };
    }

    const cookieStore = await cookies();
    const locale = cookieStore.get("NEXT_LOCALE")?.value ?? "en";

    const invite = await createInvite({
      email: parsed.data.email,
      orgId: ctx.organizationId,
      role: parsed.data.role,
      createdById: ctx.userId,
    });

    const inviteUrl = `${env.APP_URL}/invite/${invite.token}`;

    // Fire-and-forget — notification failure must not block the invite creation
    publishInviteSent({
      token: invite.token,
      email: parsed.data.email,
      inviteUrl,
      organizationName: organization.name,
      role: parsed.data.role,
      locale,
    }).catch((err) => console.error("[notifications] publishInviteSent failed", err));

    revalidatePath("/dashboard/organization");
  } catch (error) {
    console.error("[sendInviteAction] error:", error);
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
      throw new ForbiddenError("Only owners and admins can cancel invites");
    }

    await cancelInvite(inviteId, ctx.organizationId);

    revalidatePath("/dashboard/organization");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function acceptInviteAction(
  token: string,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();

    await acceptInvite(token, ctx.userId);

    revalidatePath("/dashboard/organization");
    revalidatePath("/dashboard");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function declineInviteAction(
  token: string,
): Promise<void | ActionErrorResult> {
  try {
    await declineInvite(token);

    revalidatePath('/dashboard/organization');
  } catch (error) {
    return handleActionError(error);
  }
}
