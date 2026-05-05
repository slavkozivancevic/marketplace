"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Pencil, Trash2 } from "lucide-react";
import { StarRating } from "./StarRating";
import { deleteReview, updateReview } from "../actions/reviews";
import { SerializedProductReview } from "@/types/types";
import { isActionErrorResult } from "@/features/common/errors/domainErrors";

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return "a moment ago";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  if (years === 1) return "1 year ago";
  return `${years} years ago`;
}

interface ReviewListProps {
  reviews: SerializedProductReview[];
  currentUserId?: string;
}

export function ReviewList({ reviews, currentUserId }: ReviewListProps) {
  const t = useTranslations("reviews");
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("noReviews")}</p>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <ReviewItem
          key={review.id}
          review={review}
          isOwner={currentUserId === review.user.id}
        />
      ))}
    </div>
  );
}

function ReviewItem({
  review,
  isOwner,
}: {
  review: SerializedProductReview;
  isOwner: boolean;
}) {
  const t = useTranslations("reviews");
  const tCommon = useTranslations("common");
  const [isEditing, setIsEditing] = useState(false);
  const [editRating, setEditRating] = useState(review.rating);
  const [editComment, setEditComment] = useState(review.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isEdited =
    new Date(review.updatedAt).getTime() !==
    new Date(review.createdAt).getTime();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteReview(review.id);
      if (isActionErrorResult(result)) {
        console.error(result.message);
      }
    });
  };

  const handleEdit = () => {
    setEditRating(review.rating);
    setEditComment(review.comment ?? "");
    setError(null);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
  };

  const handleSave = () => {
    if (editRating === 0) {
      setError(t("ratingRequired"));
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateReview({
        reviewId: review.id,
        rating: editRating,
        comment: editComment || undefined,
      });

      if (isActionErrorResult(result)) {
        setError(result.message);
      } else {
        setIsEditing(false);
      }
    });
  };

  if (isEditing) {
    return (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">{t("ratingLabel")}</p>
            <StarRating
              rating={editRating}
              size={20}
              interactive
              onRatingChange={setEditRating}
            />
          </div>
          <Textarea
            value={editComment}
            onChange={(e) => setEditComment(e.target.value)}
            placeholder={t("editPlaceholder")}
            rows={3}
            maxLength={2000}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? t("saving") : t("save")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isPending}
            >
              {tCommon("cancel")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <StarRating rating={review.rating} size={14} />
              <span className="text-sm font-medium truncate">
                {review.user.name ?? "Anonymous"}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground cursor-default">
                    {isEdited
                      ? formatRelativeTime(new Date(review.updatedAt))
                      : formatRelativeTime(new Date(review.createdAt))}
                    {isEdited && ` ${t("edited")}`}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{new Date(review.createdAt).toLocaleString()}</p>
                  {isEdited && (
                    <p className="text-muted-foreground">
                      Edited: {new Date(review.updatedAt).toLocaleString()}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </div>
            {review.comment && (
              <p className="text-sm text-muted-foreground">{review.comment}</p>
            )}
          </div>
          {isOwner && (
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleEdit}
                disabled={isPending}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDelete}
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
