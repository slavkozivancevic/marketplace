import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/core/db/prisma";
import {
  getProductReviews,
  getUserReviewForProduct,
  getEligibleOrderForReview,
} from "../db/reviews";
import { ReviewList } from "./ReviewList";
import { ReviewForm } from "./ReviewForm";
import { StarRating } from "./StarRating";

interface ProductReviewsSectionProps {
  productId: string;
  avgRating: number;
  ratingCount: number;
}

export async function ProductReviewsSection({
  productId,
  avgRating,
  ratingCount,
}: ProductReviewsSectionProps) {
  const reviews = await getProductReviews(productId);

  const { userId: clerkUserId } = await auth();

  let dbUserId: string | undefined;
  let canReview = false;
  let eligibleOrderId: string | null = null;

  if (clerkUserId) {
    const user = await prisma.user.findUnique({
      where: { clerkUserId },
      select: { id: true },
    });

    if (user) {
      dbUserId = user.id;
      const existingReview = await getUserReviewForProduct(productId, user.id);

      if (!existingReview) {
        eligibleOrderId = await getEligibleOrderForReview(user.id, productId);
        canReview = !!eligibleOrderId;
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">Reviews</h2>
        {ratingCount > 0 && (
          <div className="flex items-center gap-2">
            <StarRating rating={Math.round(avgRating)} size={18} />
            <span className="text-sm text-muted-foreground">
              {avgRating.toFixed(1)} ({ratingCount}{" "}
              {ratingCount === 1 ? "review" : "reviews"})
            </span>
          </div>
        )}
      </div>

      {canReview && eligibleOrderId && (
        <ReviewForm productId={productId} orderId={eligibleOrderId} />
      )}

      <ReviewList reviews={reviews} currentUserId={dbUserId} />
    </div>
  );
}
