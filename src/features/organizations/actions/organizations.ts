"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  handleActionError,
  ForbiddenError,
} from "@/features/common/errors/domainErrors";
import { requireRole } from "@/lib/auth/requireRole";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import {
  setOrganizationVerified,
  updateOrganizationName,
  removeMember,
  updateMemberRole,
} from "../db/organizations";
import {
  verifyOrganizationSchema,
  VerifyOrganizationInput,
  updateOrganizationNameSchema,
  UpdateOrganizationNameInput,
  updateMemberRoleSchema,
} from "../schema/organizations";
import { MembershipRole } from "@/generated/prisma/client";
import { ActionErrorResult } from "@/types/types";
import { publishMemberRoleChanged } from "@/services/notifications";

export async function setOrganizationVerifiedAction(
  organizationId: string,
  input: VerifyOrganizationInput,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = verifyOrganizationSchema.safeParse(input);

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    await requireRole("ADMIN");

    await setOrganizationVerified(organizationId, parsed.data.verified);

    revalidatePath("/admin/organizations");
    revalidatePath("/dashboard/organization");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateOrganizationNameAction(
  input: UpdateOrganizationNameInput,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = updateOrganizationNameSchema.safeParse(input);

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const ctx = await resolveRequestContext();

    if (ctx.membershipRole !== "OWNER" && ctx.membershipRole !== "ADMIN") {
      throw new ForbiddenError(
        "Only organization owners and admins can update organization settings",
      );
    }

    await updateOrganizationName(ctx.organizationId, parsed.data.name);

    revalidatePath("/dashboard/organization");
    revalidatePath("/admin/organizations");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function removeMemberAction(
  targetUserId: string,
): Promise<void | ActionErrorResult> {
  try {
    const ctx = await resolveRequestContext();

    if (ctx.membershipRole !== "OWNER" && ctx.membershipRole !== "ADMIN") {
      throw new ForbiddenError("Only owners and admins can remove members");
    }

    await removeMember(targetUserId, ctx.organizationId);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateMemberRoleAction(
  targetUserId: string,
  role: MembershipRole,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = updateMemberRoleSchema.safeParse({ role });

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const ctx = await resolveRequestContext();

    if (ctx.membershipRole !== "OWNER" && ctx.membershipRole !== "ADMIN") {
      throw new ForbiddenError("Only owners and admins can change member roles");
    }

    const updated = await updateMemberRole(
      targetUserId,
      ctx.organizationId,
      parsed.data.role as MembershipRole,
    );

    const cookieStore = await cookies();
    const locale = cookieStore.get("NEXT_LOCALE")?.value ?? "en";

    publishMemberRoleChanged({
      userEmail: updated.userEmail,
      userName: updated.userName,
      organizationName: updated.organizationName,
      oldRole: updated.oldRole,
      newRole: updated.newRole,
      locale,
    }).catch((err) =>
      console.error("[notifications] publishMemberRoleChanged failed", err),
    );
  } catch (error) {
    return handleActionError(error);
  }
}