import { z } from "zod/v4";

/**
 * Admin coupon form. `value` is the percent (PERCENT) or a FIXED amount in the
 * USD base (dollars); `minOrder` is dollars. The action converts FIXED amounts
 * to cents. Empty optional fields arrive as null.
 */
export const couponSchema = z
  .object({
    code: z.string().trim().min(2).max(40),
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.number().positive(),
    minOrder: z.number().nonnegative().nullable(),
    usageLimit: z.number().int().positive().nullable(),
    expiresAt: z.string().nullable(),
    active: z.boolean(),
  })
  .refine((v) => v.type !== "PERCENT" || (v.value >= 1 && v.value <= 100), {
    path: ["value"],
    error: "Percent must be between 1 and 100",
  });

export type CouponInput = z.infer<typeof couponSchema>;
