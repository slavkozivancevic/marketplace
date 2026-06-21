"use server";

import { getServerZodErrorMap } from "@/i18n/serverZodErrorMap";
import { revalidatePath } from "next/cache";
import { updateUserRoleSchema, UpdateUserRoleInput } from "../schema/users";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { updateUserRole } from "../db/users";
import { ActionErrorResult } from "@/types/types";
import { publishUserRoleChanged } from "@/services/notifications";
import { recordAudit } from "@/features/audit/db/audit";

export async function updateUserRoleAction(
  userId: string,
  input: UpdateUserRoleInput,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = updateUserRoleSchema.safeParse(input, { error: await getServerZodErrorMap() });

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((issue) => issue.message).join(", "),
      };
    }

    const result = await updateUserRole(userId, parsed.data.role);

    revalidatePath("/[locale]/admin/users", "page");
    revalidatePath("/[locale]/admin/organizations", "page");
    revalidatePath("/[locale]/dashboard", "page");
    revalidatePath("/[locale]/dashboard/organization", "page");

    if (result.roleChanged) {
      await recordAudit({
        action: "user.role_changed",
        entityType: "User",
        entityId: userId,
        diff: { role: { from: result.oldRole, to: result.newRole } },
      });
      // Recipient-targeted notification: render in the affected user's
      // preferred language, not the acting admin's session locale.
      publishUserRoleChanged({
        userEmail: result.user.email,
        userName: result.user.name,
        oldRole: result.oldRole,
        newRole: result.newRole,
        locale: result.user.locale,
      }).catch((err) =>
        console.error("[notifications] publishUserRoleChanged failed", err),
      );
    }
  } catch (error) {
    return handleActionError(error);
  }
}