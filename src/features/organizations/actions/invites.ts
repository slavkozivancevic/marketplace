"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
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
      throw new ForbiddenError({ key: "onlyOwnersAndAdminsInvites" });
    }

    const organization = await getOrganizationById(ctx.organizationId);

    if (!organization) {
      const t = await getTranslations("actionErrors");
      return { error: true, message: t("organizationNotFound") };
    }

    const cookieStore = await cookies();
    const locale = cookieStore.get("NEXT_LOCALE")?.value ?? "en";

    const invite = await createInvite({
      email: parsed.data.email,
      orgId: ctx.organizationId,
      role: parsed.data.role,
      createdById: ctx.userId,
    });

    const inviteUrl = `${env.APP_URL}/${locale}/invite/${invite.token}`;

    // Fire-and-forget - notification failure must not block the invite creation
    publishInviteSent({
      token: invite.token,
      email: parsed.data.email,
      inviteUrl,
      organizationName: organization.name,
      role: parsed.data.role,
      locale,
    }).catch((err) => console.error("[notifications] publishInviteSent failed", err));

    revalidatePath("/[locale]/dashboard/organization", "page");
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
    const ctx = await resolveRequestContext();

    await acceptInvite(token, ctx.userId);

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