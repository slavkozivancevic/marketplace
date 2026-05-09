import { z } from "zod";

export const verifyOrganizationSchema = z.object({
  verified: z.boolean(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

export const updateOrganizationNameSchema = z.object({
  name: z
    .string()
    .min(1, "Organization name is required")
    .max(100, "Organization name is too long"),
});

export type VerifyOrganizationInput = z.infer<typeof verifyOrganizationSchema>;
export type UpdateOrganizationNameInput = z.infer<
  typeof updateOrganizationNameSchema
>;
