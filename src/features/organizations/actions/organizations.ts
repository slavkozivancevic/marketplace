"use server";

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
} from "../db/organizations";
import {
  verifyOrganizationSchema,
  VerifyOrganizationInput,
  updateOrganizationNameSchema,
  UpdateOrganizationNameInput,
} from "../schema/organizations";
import { ActionErrorResult } from "@/types/types";

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
