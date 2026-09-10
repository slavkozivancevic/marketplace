import { z } from "zod/v4";
import { moneyInputSchema, nonNegativeMoneyInputSchema } from "@/lib/money-input";

/**
 * Admin coupon form.
 *
 * `value` used to be one polymorphic number - a percent for PERCENT, dollars
 * for FIXED - which forced the form to remember each meaning separately when
 * you flipped the type. It is now two fields that both always exist: `percent`
 * and `amount`. Only the one matching `type` is validated and stored, so
 * flipping the type keeps whatever you had for the other one, for free.
 *
 * `amount` and `minOrder` are MoneyInputs: an exact integer in the minor unit
 * of a currency the admin picks. The action derives the other currencies and
 * the USD mirror server-side.
 */
export const couponSchema = z
  .object({
    code: z.string().trim().min(2).max(40),
    type: z.enum(["PERCENT", "FIXED"]),
    /** Percent off. Meaningful only when `type` is PERCENT. */
    percent: z.number(),
    /** Fixed discount. Meaningful only when `type` is FIXED. */
    amount: moneyInputSchema,
    minOrder: nonNegativeMoneyInputSchema.nullable(),
    usageLimit: z.number().int().positive().nullable(),
    perUserLimit: z.number().int().positive().nullable(),
    expiresAt: z.string().nullable(),
    active: z.boolean(),
  })
  // Only the field the current type actually uses is checked, so the unused one
  // can hold a leftover value without blocking the save.
  // Localized via the Zod error map (see zodErrorMap.ts) - custom issues opt in
  // by carrying `params.i18n` instead of an inline English string.
  .superRefine((v, ctx) => {
    if (v.type === "PERCENT" && (v.percent < 1 || v.percent > 100)) {
      ctx.addIssue({
        code: "custom",
        path: ["percent"],
        params: { i18n: "couponPercentRange" },
      });
    }
    if (v.type === "FIXED" && v.amount.amount <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["amount", "amount"],
        params: { i18n: "couponAmountPositive" },
      });
    }
  });

export type CouponInput = z.infer<typeof couponSchema>;
