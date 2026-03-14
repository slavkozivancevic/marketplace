import { UserRole } from "@/generated/prisma/client";
import { resolveRequestContext } from "./resolveRequestContext";
import { ForbiddenError } from "@/features/common/errors/domainErrors";

export async function requireRole(...roles: UserRole[]) {
  const ctx = await resolveRequestContext();

  if (!roles.includes(ctx.userRole)) {
    throw new ForbiddenError("Unauthorized role");
  }

  return ctx;
}
