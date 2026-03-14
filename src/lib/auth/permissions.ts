import { MembershipRole, UserRole } from "@/generated/prisma/client";
import { Permission, RequestContext } from "../../types/types";
import {
  ForbiddenError,
  OrganizationNotVerifiedError,
} from "@/features/common/errors/domainErrors";

const rolePermissions: Record<MembershipRole, Permission[]> = {
  OWNER: ["product:create", "product:update", "product:delete", "product:read"],
  ADMIN: ["product:create", "product:update", "product:delete", "product:read"],
  MEMBER: ["product:read"],
};

function hasPermission(role: MembershipRole, permission: Permission) {
  return rolePermissions[role]?.includes(permission) ?? false;
}

function isWritePermission(permission: Permission) {
  return permission !== "product:read";
}

export function requirePermission(ctx: RequestContext, permission: Permission) {
  if (
    ctx.userRole !== UserRole.ADMIN &&
    !hasPermission(ctx.membershipRole, permission)
  ) {
    throw new ForbiddenError(`No permission for ${permission}`);
  }

  if (isWritePermission(permission) && !ctx.organizationVerified) {
    throw new OrganizationNotVerifiedError();
  }
}
