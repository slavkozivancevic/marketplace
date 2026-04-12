import { z } from "zod";

export const createReviewSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  orderId: z.string().min(1, "Order is required"),
  rating: z.coerce
    .number()
    .int()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: z
    .string()
    .max(2000, "Comment must be 2000 characters or less")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export const updateReviewSchema = z.object({
  reviewId: z.string().min(1, "Review is required"),
  rating: z.coerce
    .number()
    .int()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: z
    .string()
    .max(2000, "Comment must be 2000 characters or less")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
