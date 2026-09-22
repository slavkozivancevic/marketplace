"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { useAnnounceWhenSettled } from "@/lib/hooks/useAnnounceWhenSettled";
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
import { ActionButton } from "@/components/ActionButton";
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
  const router = useRouter();
  const queryClient = useQueryClient();
  // The delete lives here, not in the card: the card is the thing that
  // disappears, and a transition owned by an unmounted component can never
  // report that it finished. The list survives the row it deletes - it survives
  // the last one too, since the parent always renders it.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteOpenId, setDeleteOpenId] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const announceDeleted = useAnnounceWhenSettled(isDeleting);

  const handleDelete = (reviewId: string) => {
    setDeletingId(reviewId);
    startDelete(async () => {
      const result = await deleteReview(reviewId);
      if (isActionErrorResult(result)) {
        // Leave the dialog open so the failure (e.g. a rate limit) stays
        // readable next to the button that caused it.
        toast.error(result.message);
        setDeletingId(null);
        return;
      }
      // The card is server-rendered, so only a refresh removes it - and inside
      // this transition that refresh keeps the confirm button spinning until the
      // card is actually gone. The dialog is rendered inside the card and goes
      // with it, and the queued toast fires in that same frame.
      announceDeleted({ message: t("deleted") });
      // Other views of the same data are client-cached (the product grid's
      // rating, the breakdown bars); they are not what the user is looking at,
      // so they refresh alongside rather than gate anything.
      queryClient.invalidateQueries({ queryKey: ["products", "public"] });
      queryClient.invalidateQueries({
        queryKey: ["product", "rating-breakdown", productId],
      });
      router.refresh();
    });
  };

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
          isDeleting={isDeleting && deletingId === review.id}
          deleteOpen={deleteOpenId === review.id}
          onDeleteOpenChange={(open) => setDeleteOpenId(open ? review.id : null)}
          onDelete={() => handleDelete(review.id)}
        />
      ))}
    </div>
  );
}

function ReviewItem({
  review,
  isOwner,
  productId,
  isDeleting,
  deleteOpen,
  onDeleteOpenChange,
  onDelete,
}: {
  review: SerializedProductReview;
  isOwner: boolean;
  productId: string;
  /**
   * Delete state is owned by the list - see the note there. The dialog is never
   * closed by hand on success: the card it lives in is removed by the refresh,
   * in the same frame the spinner stops and the toast appears.
   */
  isDeleting: boolean;
  deleteOpen: boolean;
  onDeleteOpenChange: (open: boolean) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("reviews");
  const tCommon = useTranslations("common");
  const dl = dateLocale(useLocale());
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editRating, setEditRating] = useState(review.rating);
  const [editComment, setEditComment] = useState(review.comment ?? "");
  const [error, setError] = useState<string | null>(null);
  // Saving stays here (unlike the delete): an edited card is still on screen
  // afterwards, so this component is around to see its own transition finish.
  const [isSaving, startSave] = useTransition();
  const announceSaved = useAnnounceWhenSettled(isSaving);

  // "(edited)" reflects an author content edit only - moderation status writes
  // (approve/reject) bump updatedAt but must not flag the review as edited.
  const isEdited = review.editedAt != null;

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
        // The card is server-rendered: `router.refresh()` inside the transition
        // holds the Save spinner until the new text is on screen, and closing
        // the editor in the same transition means it never flips back to read
        // mode still showing the old text. The toast waits for that frame too.
        announceSaved({ message: t("updated") });
        queryClient.invalidateQueries({ queryKey: ["products", "public"] });
        queryClient.invalidateQueries({
          queryKey: ["product", "rating-breakdown", productId],
        });
        router.refresh();
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
          {/* Stars, author and timestamp used to share one row, so on a narrow
              column the name truncated to two letters and the date wrapped
              under it. The timestamp gets its own line instead, which leaves
              the name the full width of the card. */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <StarRating rating={review.rating} size={14} />
              <span className="min-w-0 truncate text-sm font-medium">
                {review.user.name ?? "Anonymous"}
              </span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block text-xs text-muted-foreground cursor-default">
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
            // Pulled into the card's own padding so two icon buttons do not eat
            // ~70px of a narrow card's text width.
            <div className="-mr-2 -mt-1 flex shrink-0 gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleEdit}
                disabled={isDeleting}
                aria-label={tCommon("edit")}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <ActionButton
                open={deleteOpen}
                onOpenChange={onDeleteOpenChange}
                title={t("deleteConfirm")}
                description={t("deleteDesc")}
                confirmText={tCommon("delete")}
                loadingText={t("deleting")}
                isLoading={isDeleting}
                onConfirm={onDelete}
              >
                {/* Resting control - the dialog's confirm button carries the
                    spinner. */}
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">{tCommon("delete")}</span>
                </Button>
              </ActionButton>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
