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

/** Widest range either policy field accepts, in days. A year is already far
 *  past anything a buyer would read as a promise; the cap is here to keep a
 *  typo (a pasted price, a mis-keyed year) out of the storefront. */
export const MAX_POLICY_DAYS = 365;

/**
 * Delivery estimate and return window.
 *
 * The lead time is a pair that moves together: both null (this seller promises
 * no delivery estimate, and the storefront shows none) or both set. Half a
 * range is not a weaker promise, it is an unreadable one. The return window is
 * always present - 0 is a real answer meaning returns are not accepted.
 *
 * Localized through the Zod error map; the cross-field checks opt in with
 * `params.i18n` rather than an inline English string.
 */
export const updateOrganizationPolicySchema = z
  .object({
    leadTimeMinDays: z.number().int().min(0).max(MAX_POLICY_DAYS).nullable(),
    leadTimeMaxDays: z.number().int().min(0).max(MAX_POLICY_DAYS).nullable(),
    returnWindowDays: z.number().int().min(0).max(MAX_POLICY_DAYS),
  })
  .superRefine((v, ctx) => {
    const minSet = v.leadTimeMinDays != null;
    const maxSet = v.leadTimeMaxDays != null;
    if (minSet !== maxSet) {
      ctx.addIssue({
        code: "custom",
        path: [maxSet ? "leadTimeMinDays" : "leadTimeMaxDays"],
        params: { i18n: "leadTimeNeedsBoth" },
      });
      return;
    }
    if (minSet && maxSet && v.leadTimeMinDays! > v.leadTimeMaxDays!) {
      ctx.addIssue({
        code: "custom",
        path: ["leadTimeMaxDays"],
        params: { i18n: "leadTimeMaxBeforeMin" },
      });
    }
  });

export type VerifyOrganizationInput = z.infer<typeof verifyOrganizationSchema>;
export type UpdateOrganizationNameInput = z.infer<
  typeof updateOrganizationNameSchema
>;
export type UpdateOrganizationShippingInput = z.infer<
  typeof updateOrganizationShippingSchema
>;
export type UpdateOrganizationPolicyInput = z.infer<
  typeof updateOrganizationPolicySchema
>;
