import { UserRole } from "@/generated/prisma/client";
import { resolveRequestContext } from "./resolveRequestContext";
import { ForbiddenError } from "@/features/common/errors/domainErrors";
import { assertWritable } from "./permissions";

export async function requireRole(...roles: UserRole[]) {
  const ctx = await resolveRequestContext();

  if (!roles.includes(ctx.userRole)) {
    throw new ForbiddenError("Unauthorized role");
  }

  return ctx;
}

/**
 * The gate for every platform-admin WRITE. `requireRole("ADMIN")` plus the
 * demo check: the public demo admin opens every admin screen (the admin layout
 * reads through `requireRole`) but saves nothing.
 */
export async function requireAdminWrite() {
  const ctx = await requireRole(UserRole.ADMIN);
  assertWritable(ctx);
  return ctx;
}
