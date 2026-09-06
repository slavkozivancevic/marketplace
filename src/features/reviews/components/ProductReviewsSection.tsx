import { safeAuth } from "@/lib/auth/safeAuth";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("reviews");
  const reviews = await getProductReviews(productId);

  const { userId: clerkUserId } = await safeAuth();

  let dbUserId: string | undefined;
  let canReview = false;
  let eligibleOrderId: string | null = null;
  // The author's own review when it isn't APPROVED yet - merged into the list so
  // they can see its moderation status (others never receive it).
  let ownPendingReview: Awaited<ReturnType<typeof getUserReviewForProduct>> = null;

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
      } else if (existingReview.status !== "APPROVED") {
        ownPendingReview = existingReview;
      }
    }
  }

  // Prepend the author's own non-approved review, and guard against it also
  // appearing in the public list during a brief cache-revalidation window (would
  // otherwise duplicate a React key).
  const displayReviews = ownPendingReview
    ? [ownPendingReview, ...reviews.filter((r) => r.id !== ownPendingReview!.id)]
    : reviews;

  return (
    <div className="space-y-6">
      {/* Wraps as a whole rating group rather than letting "2.0 (1 recenzija)"
          split across lines mid-phrase, which is what a plain flex row did on a
          narrow column. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold">{t("heading")}</h2>
        {ratingCount > 0 && (
          <div className="flex items-center gap-2">
            <StarRating rating={avgRating} size={18} />
            <span className="whitespace-nowrap text-sm text-muted-foreground">
              {avgRating.toFixed(1)} ({t("countLabel", { count: ratingCount })})
            </span>
          </div>
        )}
      </div>

      {canReview && eligibleOrderId && (
        <ReviewForm productId={productId} orderId={eligibleOrderId} />
      )}

      <ReviewList
        reviews={displayReviews}
        currentUserId={dbUserId}
        productId={productId}
      />
    </div>
  );
}
