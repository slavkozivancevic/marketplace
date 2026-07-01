"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { StarRating } from "./StarRating";
import { deleteReview, updateReview } from "../actions/reviews";
import { SerializedProductReview } from "@/types/types";
import { isActionErrorResult } from "@/features/common/errors/actionErrorResult";

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
  productId: string;
}

export function ReviewList({ reviews, currentUserId, productId }: ReviewListProps) {
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
          productId={productId}
        />
      ))}
    </div>
  );
}

function ReviewItem({
  review,
  isOwner,
  productId,
}: {
  review: SerializedProductReview;
  isOwner: boolean;
  productId: string;
}) {
  const t = useTranslations("reviews");
  const tCommon = useTranslations("common");
  const dl = dateLocale(useLocale());
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editRating, setEditRating] = useState(review.rating);
  const [editComment, setEditComment] = useState(review.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Separate transitions for save vs delete: they render different spinners
  // (Save button vs trash icon). Sharing one made the trash icon briefly spin
  // after a save, since the transition was still settling as the form closed.
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  // Close the confirm dialog once the delete settles.
  const wasDeleting = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (wasDeleting.current && !isDeleting) setDeleteOpen(false);
    wasDeleting.current = isDeleting && deleteOpen;
  }, [isDeleting, deleteOpen]);

  // "(edited)" reflects an author content edit only - moderation status writes
  // (approve/reject) bump updatedAt but must not flag the review as edited.
  const isEdited = review.editedAt != null;

  const handleDelete = () => {
    startDelete(async () => {
      const result = await deleteReview(review.id);
      if (isActionErrorResult(result)) {
        // Surface the failure (e.g. rate limit) - the confirm dialog has closed,
        // so a toast is the right channel for this row action.
        toast.error(result.message);
      } else {
        queryClient.invalidateQueries({ queryKey: ["products", "public"] });
        queryClient.invalidateQueries({ queryKey: ["product", "rating-breakdown", productId] });
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
    startSave(async () => {
      const result = await updateReview({
        reviewId: review.id,
        rating: editRating,
        comment: editComment || undefined,
      });

      if (isActionErrorResult(result)) {
        setError(result.message);
      } else {
        setIsEditing(false);
        queryClient.invalidateQueries({ queryKey: ["products", "public"] });
        queryClient.invalidateQueries({ queryKey: ["product", "rating-breakdown", productId] });
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
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              {isSaving ? t("saving") : t("save")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
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
                    {isEdited && review.editedAt
                      ? formatRelativeTime(new Date(review.editedAt))
                      : formatRelativeTime(new Date(review.createdAt))}
                    {isEdited && ` ${t("edited")}`}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{new Date(review.createdAt).toLocaleString(dl)}</p>
                  {isEdited && review.editedAt && (
                    <p className="text-muted-foreground">
                      Edited: {new Date(review.editedAt).toLocaleString(dl)}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </div>
            {review.comment && (
              <p className="text-sm text-muted-foreground">{review.comment}</p>
            )}
            {review.status === "PENDING" && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                {t("pendingHint")}
              </p>
            )}
            {review.status === "REJECTED" && (
              <p className="text-xs text-destructive">
                {review.moderationReason
                  ? t("rejectedReason", { reason: review.moderationReason })
                  : t("rejectedHint")}
              </p>
            )}
          </div>
          {isOwner && (
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleEdit}
                disabled={isDeleting}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog
                open={deleteOpen}
                onOpenChange={(next) => {
                  if (isDeleting) return;
                  setDeleteOpen(next);
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    <span className="sr-only">{tCommon("delete")}</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("deleteConfirm")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("deleteDesc")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                      {tCommon("cancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete();
                      }}
                      disabled={isDeleting}
                      variant="destructiveSolid"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("deleting")}
                        </>
                      ) : (
                        tCommon("delete")
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
