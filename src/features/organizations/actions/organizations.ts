"use server";
import { logger } from "@/lib/logger";

import { getServerZodErrorMap } from "@/i18n/serverZodErrorMap";
import { revalidatePath } from "next/cache";
import {
  handleActionError,
  ForbiddenError,
} from "@/features/common/errors/domainErrors";
import { requireRole } from "@/lib/auth/requireRole";
import { resolveRequestContext } from "@/lib/auth/resolveRequestContext";
import {
  setOrganizationVerified,
  updateOrganizationName,
  updateOrganizationShipping,
  removeMember,
  updateMemberRole,
} from "../db/organizations";
import {
  verifyOrganizationSchema,
  VerifyOrganizationInput,
  updateOrganizationNameSchema,
  UpdateOrganizationNameInput,
  updateOrganizationShippingSchema,
  UpdateOrganizationShippingInput,
  updateMemberRoleSchema,
} from "../schema/organizations";
import { MembershipRole } from "@/generated/prisma/client";
import { decimalToCents } from "@/lib/currency";
import { ActionErrorResult } from "@/types/types";
import { publishMemberRoleChanged } from "@/services/notifications";
import { recordAudit } from "@/features/audit/db/audit";

export async function setOrganizationVerifiedAction(
  organizationId: string,
  input: VerifyOrganizationInput,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = verifyOrganizationSchema.safeParse(input, { error: await getServerZodErrorMap() });

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    await requireRole("ADMIN");

    await setOrganizationVerified(organizationId, parsed.data.verified);
    await recordAudit({
      action: "organization.verified_changed",
      entityType: "Organization",
      entityId: organizationId,
      diff: { verified: parsed.data.verified },
    });

    revalidatePath("/[locale]/admin/organizations", "page");
    revalidatePath("/[locale]/dashboard/organization", "page");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateOrganizationNameAction(
  input: UpdateOrganizationNameInput,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = updateOrganizationNameSchema.safeParse(input, { error: await getServerZodErrorMap() });

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const ctx = await resolveRequestContext();

    if (ctx.membershipRole !== "OWNER" && ctx.membershipRole !== "ADMIN") {
      throw new ForbiddenError({ key: "onlyOwnersAndAdminsChangeRoles" });
    }

    await updateOrganizationName(ctx.organizationId, parsed.data.name);

    revalidatePath("/[locale]/dashboard/organization", "page");
    revalidatePath("/[locale]/admin/organizations", "page");
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateOrganizationShippingAction(
  input: UpdateOrganizationShippingInput,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = updateOrganizationShippingSchema.safeParse(input, {
      error: await getServerZodErrorMap(),
    });
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }

    const ctx = await resolveRequestContext();
    if (ctx.membershipRole !== "OWNER" && ctx.membershipRole !== "ADMIN") {
      throw new ForbiddenError({ key: "onlyOwnersAndAdminsChangeRoles" });
    }

    await updateOrganizationShipping(ctx.organizationId, {
      shippingFlatRate: decimalToCents(parsed.data.shippingFlatRate),
      shippingFreeThreshold:
        parsed.data.shippingFreeThreshold != null
          ? decimalToCents(parsed.data.shippingFreeThreshold)
          : null,
    });

    revalidatePath("/[locale]/dashboard/organization", "page");
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
      throw new ForbiddenError({ key: "onlyOwnersAndAdminsRemoveMembers" });
    }

    await removeMember(targetUserId, ctx.organizationId);
    await recordAudit({
      action: "member.removed",
      entityType: "Membership",
      entityId: targetUserId,
    });
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateMemberRoleAction(
  targetUserId: string,
  role: MembershipRole,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = updateMemberRoleSchema.safeParse({ role }, { error: await getServerZodErrorMap() });

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const ctx = await resolveRequestContext();

    if (ctx.membershipRole !== "OWNER" && ctx.membershipRole !== "ADMIN") {
      throw new ForbiddenError({ key: "onlyOwnersAndAdminsChangeRoles" });
    }

    const updated = await updateMemberRole(
      targetUserId,
      ctx.organizationId,
      parsed.data.role as MembershipRole,
    );

    await recordAudit({
      action: "member.role_changed",
      entityType: "Membership",
      entityId: targetUserId,
      diff: { role: { from: updated.oldRole, to: updated.newRole }, member: updated.userEmail },
    });

    // Recipient-targeted notification: the email goes to the member whose
    // role just changed, so it must render in THEIR preferred language,
    // not the acting admin's.
    publishMemberRoleChanged({
      userEmail: updated.userEmail,
      userName: updated.userName,
      organizationName: updated.organizationName,
      oldRole: updated.oldRole,
      newRole: updated.newRole,
      locale: updated.userLocale,
    }).catch((err) =>
      logger.error("[notifications] publishMemberRoleChanged failed", err),
    );

    // Refresh the member list so the saved role is reflected back to the UI
    // (without this the row would stay stuck in its "unsaved" state).
    revalidatePath("/[locale]/dashboard/organization", "page");
    revalidatePath("/[locale]/admin/organizations", "page");
  } catch (error) {
    return handleActionError(error);
  }
}