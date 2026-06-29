import { z } from "zod";

export const createReviewSchema = z.object({
  productId: z.string().min(1),
  orderId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z
    .string()
    .max(2000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export const updateReviewSchema = z.object({
  reviewId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z
    .string()
    .max(2000)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

// Admin moderation: approve or reject (PENDING is not a manual target - it's
// the default/uncertain state). Reason is optional and surfaced on rejection.
export const moderateReviewSchema = z.object({
  reviewId: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED"]),
  reason: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;
