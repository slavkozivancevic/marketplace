import { z } from "zod";
import { nonNegativeMoneyInputSchema } from "@/lib/money-input";

export const verifyOrganizationSchema = z.object({
  verified: z.boolean(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

export const updateOrganizationNameSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

// Shipping config as MoneyInput: the seller enters a fee in a currency they
// pick, and that exact amount is what buyers in that currency are charged. The
// action derives the other currencies and the USD mirror server-side.
// Threshold null = never free; flat rate 0 = always free.
export const updateOrganizationShippingSchema = z.object({
  shippingFlatRate: nonNegativeMoneyInputSchema,
  shippingFreeThreshold: nonNegativeMoneyInputSchema.nullable(),
});

export type VerifyOrganizationInput = z.infer<typeof verifyOrganizationSchema>;
export type UpdateOrganizationNameInput = z.infer<
  typeof updateOrganizationNameSchema
>;
export type UpdateOrganizationShippingInput = z.infer<
  typeof updateOrganizationShippingSchema
>;
