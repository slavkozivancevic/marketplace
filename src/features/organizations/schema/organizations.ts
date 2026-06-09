import { z } from "zod";

export const verifyOrganizationSchema = z.object({
  verified: z.boolean(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

export const updateOrganizationNameSchema = z.object({
  name: z.string().min(1).max(100),
});

export type VerifyOrganizationInput = z.infer<typeof verifyOrganizationSchema>;
export type UpdateOrganizationNameInput = z.infer<
  typeof updateOrganizationNameSchema
>;
