import { MembershipRole, UserRole } from "@/generated/prisma/client";
import { Permission, RequestContext } from "../../types/types";
import {
  ForbiddenError,
  OrganizationNotVerifiedError,
} from "@/features/common/errors/domainErrors";

const rolePermissions: Record<MembershipRole, Permission[]> = {
  OWNER: ["product:create", "product:update", "product:delete", "product:read", "order:read", "order:manage", "payout:manage"],
  ADMIN: ["product:create", "product:update", "product:delete", "product:read", "order:read", "order:manage", "payout:manage"],
  MEMBER: ["product:read", "order:read"],
};

function hasPermission(role: MembershipRole, permission: Permission) {
  return rolePermissions[role]?.includes(permission) ?? false;
}

/**
 * Whether a membership role may view/manage the org's payouts. Single source of
 * truth shared by the payouts page guard and the nav/card visibility, so the
 * sidebar and dashboard never offer a link the page would bounce.
 */
export function canManageOrgPayouts(role: MembershipRole): boolean {
  return hasPermission(role, "payout:manage");
}

function isWritePermission(permission: Permission) {
  return permission !== "product:read" && permission !== "order:read";
}

export function requirePermission(ctx: RequestContext, permission: Permission) {
  // Platform admins operate the marketplace itself. They bypass BOTH the
  // membership-role check and the seller verification gate: verification is a
  // merchant KYC requirement that doesn't apply to the platform operator, and
  // their active org (which may be any org) must never block admin tooling.
  if (ctx.userRole === UserRole.ADMIN) {
    return;
  }

  if (!hasPermission(ctx.membershipRole, permission)) {
    throw new ForbiddenError(`No permission for ${permission}`);
  }

  if (isWritePermission(permission) && !ctx.organizationVerified) {
    throw new OrganizationNotVerifiedError();
  }
}
