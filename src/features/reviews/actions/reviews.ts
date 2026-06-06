"use server";

import {
  createReviewSchema,
  CreateReviewInput,
  updateReviewSchema,
  UpdateReviewInput,
} from "../schema/reviews";
import { handleActionError } from "@/features/common/errors/domainErrors";
import {
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
} from "@/features/common/errors/domainErrors";
import { ActionErrorResult } from "@/types/types";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";
import {
  createReview,
  updateReview as dbUpdateReview,
  deleteReview as dbDeleteReview,
  hasUserPurchasedProduct,
  getUserReviewForProduct,
} from "../db/reviews";

async function resolveUserId(): Promise<string> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) throw new UnauthenticatedError();

  const user = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true },
  });

  if (!user) throw new UnauthenticatedError();
  return user.id;
}

export async function submitReview(
  unsafeData: CreateReviewInput,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = createReviewSchema.safeParse(unsafeData);

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const userId = await resolveUserId();
    const { productId, orderId, rating, comment } = parsed.data;

    const hasPurchased = await hasUserPurchasedProduct(userId, productId);
    if (!hasPurchased) {
      throw new ForbiddenError({ key: "cannotReviewUnpurchased" });
    }

    const existingReview = await getUserReviewForProduct(productId, userId);
    if (existingReview) {
      throw new ForbiddenError({ key: "alreadyReviewed" });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId, status: "COMPLETED" },
      select: { id: true },
    });
    if (!order) {
      throw new NotFoundError("Order not found");
    }

    await createReview({ productId, userId, orderId, rating, comment });
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateReview(
  unsafeData: UpdateReviewInput,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = updateReviewSchema.safeParse(unsafeData);

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const userId = await resolveUserId();
    const { reviewId, rating, comment } = parsed.data;

    const result = await dbUpdateReview({ reviewId, userId, rating, comment });
    if (!result) {
      throw new NotFoundError("Review not found");
    }
  } catch (error) {
    return handleActionError(error);
  }
}

export async function deleteReview(
  reviewId: string,
): Promise<void | ActionErrorResult> {
  try {
    const userId = await resolveUserId();

    const result = await dbDeleteReview(reviewId, userId);
    if (!result) {
      throw new NotFoundError("Review not found");
    }
  } catch (error) {
    return handleActionError(error);
  }
}
