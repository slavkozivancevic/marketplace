import { prisma } from "@/core/db/prisma";
import { cacheTag } from "next/cache";
import { CacheTags } from "@/lib/cache/tags";
import { SerializedProductReview } from "@/types/types";
import { revalidateReviewCache } from "./cache";

export async function getProductReviews(
  productId: string,
): Promise<SerializedProductReview[]> {
  "use cache";
  cacheTag(CacheTags.reviews.byProduct(productId));

  const reviews = await prisma.productReview.findMany({
    where: { productId },
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
  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.productReview.create({
      data: { productId, userId, orderId, rating, comment },
    });

    const aggregate = await tx.productReview.aggregate({
      where: { productId },
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
    select: { userId: true, productId: true },
  });

  if (!existing || existing.userId !== userId) {
    return null;
  }

  const review = await prisma.$transaction(async (tx) => {
    const updated = await tx.productReview.update({
      where: { id: reviewId },
      data: { rating, comment: comment ?? null },
    });

    const aggregate = await tx.productReview.aggregate({
      where: { productId: existing.productId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.product.update({
      where: { id: existing.productId },
      data: {
        avgRating: aggregate._avg.rating ?? 0,
        ratingCount: aggregate._count.rating,
      },
    });

    return updated;
  });

  revalidateReviewCache(existing.productId, userId);

  return review;
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

    const aggregate = await tx.productReview.aggregate({
      where: { productId: review.productId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.product.update({
      where: { id: review.productId },
      data: {
        avgRating: aggregate._avg.rating ?? 0,
        ratingCount: aggregate._count.rating,
      },
    });
  });

  revalidateReviewCache(review.productId, userId);

  return review;
}
