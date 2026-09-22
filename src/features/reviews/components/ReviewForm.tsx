"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StarRating } from "./StarRating";
import { submitReview } from "../actions/reviews";
import { isActionErrorResult } from "@/features/common/errors/actionErrorResult";

interface ReviewFormProps {
  productId: string;
  orderId: string;
}

export function ReviewForm({ productId, orderId }: ReviewFormProps) {
  const t = useTranslations("reviews");
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (rating === 0) {
      setError(t("ratingRequired"));
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await submitReview({
        productId,
        orderId,
        rating,
        comment: comment || undefined,
      });

      if (isActionErrorResult(result)) {
        setError(result.message);
      } else {
        // No success toast here, deliberately - and none is missing.
        //
        // The write revalidates this page (revalidateReviewCache ->
        // revalidatePath on the product route), so the transition stays pending
        // until the new payload lands, and that payload replaces this form with
        // the review itself - carrying the "awaiting moderation" hint when it
        // isn't approved yet. The result IS the confirmation, and it arrives on
        // the falling edge of the spinner.
        //
        // An announced toast could not be raised from here anyway:
        // useAnnounceWhenSettled fires from an effect, and this component is
        // gone by then (ProductReviewsSection stops rendering it once a review
        // exists). That is the same reason review deletion had to be lifted out
        // of the card and into ReviewList.
        //
        // Not awaited: these only refresh the rating shown in other React Query
        // views (cards, breakdown), which are not what the user is looking at,
        // and awaiting them would hold the spinner past the moment the review
        // appears.
        queryClient.invalidateQueries({ queryKey: ["products", "public"] });
        queryClient.invalidateQueries({ queryKey: ["product", "rating-breakdown", productId] });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("write")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-medium">{t("rating")}</p>
            {rating > 0 && (
              <button
                type="button"
                onClick={() => setRating(0)}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Clear rating"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <StarRating
            rating={rating}
            size={24}
            interactive
            onRatingChange={setRating}
          />
        </div>

        <div>
          <Textarea
            placeholder={t("experience")}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSubmit} disabled={isPending || rating === 0}>
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? t("submitting") : t("submit")}
        </Button>
      </CardContent>
    </Card>
  );
}
