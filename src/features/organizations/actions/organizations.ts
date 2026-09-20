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
import { syncClerkUserMetadata } from "@/services/clerk";
import {
  setOrganizationVerified,
  updateOrganizationName,
  updateOrganizationShipping,
  removeMember,
  updateMemberRole,
  getOrganizationById,
  listMemberManagers,
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
import { moneyUsdCents, parseMoney } from "@/lib/money";
import { buildMoneySet, preserveDerived } from "@/lib/money-input";
import { getCurrencyRates } from "@/features/currency/db/currencyRates";
import { ActionErrorResult } from "@/types/types";
import {
  publishMemberAccessRevoked,
  publishMemberRemoved,
  publishMemberRoleChanged,
} from "@/services/notifications";
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

    // Rates are read here, never taken from the request: a stale or tampered
    // client rate must not be able to decide what a seller charges.
    const rates = await getCurrencyRates();
    // A fee the seller did not touch keeps the derived currencies it already
    // had. Otherwise merely flipping the free-shipping switch would re-price the
    // flat rate for every buyer outside the seller's own currency.
    const stored = await getOrganizationById(ctx.organizationId);
    const flatRate = preserveDerived(
      buildMoneySet(parsed.data.shippingFlatRate, rates),
      parseMoney(stored?.shippingFlatRateMoney),
    );
    const freeThreshold =
      parsed.data.shippingFreeThreshold != null
        ? preserveDerived(
            buildMoneySet(parsed.data.shippingFreeThreshold, rates),
            parseMoney(stored?.shippingFreeThresholdMoney),
          )
        : null;

    await updateOrganizationShipping(ctx.organizationId, {
      shippingFlatRate: moneyUsdCents(flatRate),
      shippingFlatRateMoney: flatRate,
      shippingFreeThreshold: freeThreshold != null ? moneyUsdCents(freeThreshold) : null,
      shippingFreeThresholdMoney: freeThreshold,
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

    const removed = await removeMember(targetUserId, ctx.organizationId);
    await recordAudit({
      action: "member.removed",
      entityType: "Membership",
      entityId: targetUserId,
      diff: { role: removed.removedRole, member: removed.userEmail },
    });

    // removeMember already moved them off this org in the DB; mirror it into
    // Clerk so their live session re-scopes on the next request instead of
    // carrying a claim for an org they no longer belong to. Only when they were
    // actually moved and landed somewhere: the metadata sync requires an org
    // id, a user with no memberships left has no dashboard to scope, and a
    // member who was working in a different org needs no write at all (Clerk
    // rate-limits writes). The sync swallows its own failures - it is a cache
    // of the DB, not the source of truth.
    if (removed.activeOrgChanged && removed.newActiveOrgId) {
      await syncClerkUserMetadata({
        clerkUserId: removed.userClerkId,
        dbId: removed.userId,
        role: removed.userRole,
        activeOrgId: removed.newActiveOrgId,
      });
    }

    // Recipient-targeted, like the role-change email: it goes to the member who
    // was just removed, so it renders in THEIR language, not the acting admin's.
    // Fire-and-forget - a notification failure must not undo the removal.
    publishMemberAccessRevoked({
      userEmail: removed.userEmail,
      userName: removed.userName,
      organizationName: removed.organizationName,
      removedRole: removed.removedRole,
      locale: removed.userLocale,
    }).catch((err) =>
      logger.error("[notifications] publishMemberAccessRevoked failed", err),
    );

    // And the org's other owners/admins, same as when a member's account is
    // closed - who holds access is security-relevant to everyone who manages
    // it, not just to whoever happened to click. The actor is left out; they
    // already know. Each email renders in its own recipient's language, so the
    // fan-out is per recipient rather than one shared render.
    const managers = await listMemberManagers(ctx.organizationId, {
      excludeUserId: ctx.userId,
    });
    for (const manager of managers) {
      publishMemberRemoved({
        recipientEmail: manager.email,
        recipientName: manager.name,
        organizationName: removed.organizationName,
        removedUserName: removed.userName,
        removedUserEmail: removed.userEmail,
        removedRole: removed.removedRole,
        reason: "removed_by_admin",
        locale: manager.locale ?? "en",
      }).catch((err) =>
        logger.error("[notifications] publishMemberRemoved failed", err),
      );
    }
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