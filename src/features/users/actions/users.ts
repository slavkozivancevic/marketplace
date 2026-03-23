"use server";

import { revalidatePath } from "next/cache";
import { updateUserRoleSchema, UpdateUserRoleInput } from "../schema/users";
import { handleActionError } from "@/features/common/errors/domainErrors";
import { updateUserRole } from "../db/users";
import { ActionErrorResult } from "@/types/types";

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

    await updateUserRole(userId, parsed.data.role);

    revalidatePath("/admin/users");
  } catch (error) {
    return handleActionError(error);
  }
}
