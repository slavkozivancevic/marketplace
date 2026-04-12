"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StarRating } from "./StarRating";
import { submitReview } from "../actions/reviews";
import { isActionErrorResult } from "@/features/common/errors/domainErrors";

interface ReviewFormProps {
  productId: string;
  orderId: string;
}

export function ReviewForm({ productId, orderId }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (rating === 0) {
      setError("Please select a rating");
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
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Write a Review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Your rating</p>
          <StarRating
            rating={rating}
            size={24}
            interactive
            onRatingChange={setRating}
          />
        </div>

        <div>
          <Textarea
            placeholder="Share your experience (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSubmit} disabled={isPending || rating === 0}>
          {isPending ? "Submitting..." : "Submit Review"}
        </Button>
      </CardContent>
    </Card>
  );
}
