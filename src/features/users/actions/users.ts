"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { updateUserRoleSchema, UpdateUserRoleInput } from "../schema/users";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { updateUserRole } from "../db/users";
import { ActionErrorResult } from "@/types/types";
import { publishUserRoleChanged } from "@/services/notifications";

export async function updateUserRoleAction(
  userId: string,
  input: UpdateUserRoleInput,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = updateUserRoleSchema.safeParse(input);

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((issue) => issue.message).join(", "),
      };
    }

    const result = await updateUserRole(userId, parsed.data.role);

    revalidatePath("/admin/users");
    revalidatePath("/admin/organizations");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/organization");

    if (result.roleChanged) {
      const cookieStore = await cookies();
      const locale = cookieStore.get("NEXT_LOCALE")?.value ?? "en";

      publishUserRoleChanged({
        userEmail: result.user.email,
        userName: result.user.name,
        oldRole: result.oldRole,
        newRole: result.newRole,
        locale,
      }).catch((err) =>
        console.error("[notifications] publishUserRoleChanged failed", err),
      );
    }
  } catch (error) {
    return handleActionError(error);
  }
}