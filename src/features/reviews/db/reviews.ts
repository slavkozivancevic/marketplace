import { prisma, type TransactionClient } from "@/core/db/prisma";
import { cacheTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";
import { SerializedProductReview } from "@/types/types";
import { ReviewStatus } from "@/generated/prisma/client";
import { revalidateReviewCache } from "./cache";

/**
 * Recomputes a product's denormalized rating from its APPROVED reviews only.
 * PENDING / REJECTED reviews never influence the public rating. Runs inside the
 * caller's transaction so the review change and the aggregate stay consistent.
 */
async function recomputeRating(
  tx: TransactionClient,
  productId: string,
): Promise<void> {
  const aggregate = await tx.productReview.aggregate({
    where: { productId, status: "APPROVED" },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await tx.product.update({
    where: { id: productId },
    data: {
      avgRating: aggregate._avg.rating ?? 0,
      ratingCount: aggregate._count.rating,
    },
  });
}

export async function getProductReviews(
  productId: string,
): Promise<SerializedProductReview[]> {
  "use cache";
  cacheTag(CacheTags.reviews.byProduct(productId));

  // Public list: only APPROVED reviews are shown. The author's own pending /
  // rejected review is fetched separately and merged in by the section.
  const reviews = await prisma.productReview.findMany({
    where: { productId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, imageUrl: true },
      },
    },
  });

  return reviews;
}

export async function getUserReviewForProduct(
  productId: string,
  userId: string,
): Promise<SerializedProductReview | null> {
  "use cache";
  cacheTag(CacheTags.reviews.userReview(productId, userId));

  // Returns the author's review regardless of moderation status, so they can
  // see their own PENDING / REJECTED review (with its reason) and we can block
  // a duplicate submission.
  const review = await prisma.productReview.findUnique({
    where: { productId_userId: { productId, userId } },
    include: {
      user: {
        select: { id: true, name: true, imageUrl: true },
      },
    },
  });

  return review;
}

export async function hasUserPurchasedProduct(
  userId: string,
  productId: string,
): Promise<boolean> {
  const orderItem = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { userId, status: "COMPLETED" },
    },
    select: { id: true },
  });

  return !!orderItem;
}

export async function getEligibleOrderForReview(
  userId: string,
  productId: string,
): Promise<string | null> {
  const orderItem = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { userId, status: "COMPLETED" },
    },
    orderBy: { order: { createdAt: "desc" } },
    select: { orderId: true },
  });

  return orderItem?.orderId ?? null;
}

export async function createReview({
  productId,
  userId,
  orderId,
  rating,
  comment,
}: {
  productId: string;
  userId: string;
  orderId: string;
  rating: number;
  comment?: string;
}) {
  // New reviews start PENDING (schema default); the caller runs moderation and
  // applies the decision via setReviewModeration. The rating aggregate is
  // recomputed APPROVED-only, so a fresh PENDING review does not move it.
  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.productReview.create({
      data: { productId, userId, orderId, rating, comment },
    });

    await recomputeRating(tx, productId);

    return created;
  });

  revalidateReviewCache(productId, userId);

  return review;
}

export async function updateReview({
  reviewId,
  userId,
  rating,
  comment,
}: {
  reviewId: string;
  userId: string;
  rating: number;
  comment?: string;
}) {
  const existing = await prisma.productReview.findUnique({
    where: { id: reviewId },
    select: { userId: true, productId: true, comment: true },
  });

  if (!existing || existing.userId !== userId) {
    return null;
  }

  // Only a change to the comment TEXT requires re-moderation - that's the only
  // thing moderation judges. A rating-only edit keeps the existing decision
  // (status, reason) untouched, so an approved review doesn't bounce back to
  // PENDING just because the author nudged the stars.
  const newComment = comment ?? null;
  const commentChanged = (existing.comment ?? null) !== newComment;

  await prisma.$transaction(async (tx) => {
    await tx.productReview.update({
      where: { id: reviewId },
      data: {
        rating,
        comment: newComment,
        // Any author change flags "(edited)".
        editedAt: new Date(),
        // Re-moderate only when the text changed.
        ...(commentChanged
          ? { status: "PENDING", moderationReason: null, moderatedAt: null }
          : {}),
      },
    });

    await recomputeRating(tx, existing.productId);
  });

  revalidateReviewCache(existing.productId, userId);

  return { productId: existing.productId, commentChanged };
}

/**
 * Applies a moderation decision (auto from AI, or manual from an admin) to a
 * review: sets status + reason, stamps moderatedAt, and recomputes the product
 * rating (APPROVED-only). Returns the product/user ids so the caller can
 * revalidate caches. Returns null if the review no longer exists.
 */
export async function setReviewModeration(
  reviewId: string,
  status: ReviewStatus,
  moderationReason: string | null,
): Promise<{ productId: string; userId: string } | null> {
  const existing = await prisma.productReview.findUnique({
    where: { id: reviewId },
    select: { productId: true, userId: true },
  });
  if (!existing) return null;

  await prisma.$transaction(async (tx) => {
    await tx.productReview.update({
      where: { id: reviewId },
      data: {
        status,
        moderationReason: status === "APPROVED" ? null : moderationReason,
        moderatedAt: new Date(),
      },
    });

    await recomputeRating(tx, existing.productId);
  });

  revalidateReviewCache(existing.productId, existing.userId);

  return existing;
}

export async function deleteReview(reviewId: string, userId: string) {
  const review = await prisma.productReview.findUnique({
    where: { id: reviewId },
    select: { userId: true, productId: true },
  });

  if (!review || review.userId !== userId) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.productReview.delete({ where: { id: reviewId } });

    await recomputeRating(tx, review.productId);
  });

  revalidateReviewCache(review.productId, userId);

  return review;
}
