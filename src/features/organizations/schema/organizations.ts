import { z } from "zod";

export const verifyOrganizationSchema = z.object({
  verified: z.boolean(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

export const updateOrganizationNameSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

// Shipping config in dollars (the form works in the display currency; the action
// converts to USD base cents). Threshold null = never free.
export const updateOrganizationShippingSchema = z.object({
  shippingFlatRate: z.number().min(0),
  shippingFreeThreshold: z.number().min(0).nullable(),
});

export type VerifyOrganizationInput = z.infer<typeof verifyOrganizationSchema>;
export type UpdateOrganizationNameInput = z.infer<
  typeof updateOrganizationNameSchema
>;
export type UpdateOrganizationShippingInput = z.infer<
  typeof updateOrganizationShippingSchema
>;
