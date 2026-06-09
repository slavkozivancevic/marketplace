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

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
