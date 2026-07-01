"use server";

import { getServerZodErrorMap } from "@/i18n/serverZodErrorMap";
import { revalidatePath } from "next/cache";
import {
  createReviewSchema,
  CreateReviewInput,
  updateReviewSchema,
  UpdateReviewInput,
  moderateReviewSchema,
  ModerateReviewInput,
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
import { requireRole } from "@/lib/auth/requireRole";
import { recordAudit } from "@/features/audit/db/audit";
import { enforceRateLimit } from "@/lib/rateLimit/guard";
import { moderateReview as runAiModeration } from "@/services/aiModeration";
import { publishReviewModerated } from "@/services/notifications";
import { getPathname } from "@/i18n/navigation";
import { getProductTitle, getProductSlug } from "@/features/products/utils/translations";
import {
  createReview,
  updateReview as dbUpdateReview,
  deleteReview as dbDeleteReview,
  setReviewModeration,
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

/**
 * Runs AI moderation for a just-created/edited review and applies the decision.
 * The review already exists as PENDING; this only upgrades it to APPROVED /
 * REJECTED when the classifier is confident. A PENDING result is a no-op (the
 * review waits for an admin), so submission is never blocked on AI availability.
 */
async function applyModeration(
  reviewId: string,
  rating: number,
  comment?: string,
): Promise<void> {
  const decision = await runAiModeration({ rating, comment });
  if (decision.status === "PENDING") return;
  await setReviewModeration(reviewId, decision.status, decision.reason);
}

/**
 * Best-effort author notification after an admin moderation decision. Resolves
 * the author + product (title/slug in the author's locale) and publishes the
 * email event. Swallows all errors - notifications must never fail moderation.
 */
async function notifyAuthorOfDecision(
  reviewId: string,
  status: "APPROVED" | "REJECTED",
  reason: string | null,
): Promise<void> {
  try {
    const review = await prisma.productReview.findUnique({
      where: { id: reviewId },
      select: {
        rating: true,
        comment: true,
        user: { select: { email: true, name: true, locale: true } },
        product: {
          select: { translations: { select: { locale: true, title: true, slug: true } } },
        },
      },
    });
    if (!review) return;

    const locale = review.user.locale;
    const slug = getProductSlug(review.product, locale);
    const productPath = getPathname({
      href: { pathname: "/products/[slug]", params: { slug } },
      locale,
    });

    await publishReviewModerated({
      userEmail: review.user.email,
      userName: review.user.name,
      productName: getProductTitle(review.product, locale),
      productPath,
      status,
      rating: review.rating,
      comment: review.comment,
      reason,
      locale,
    });
  } catch (err) {
    console.error("[reviews] notifyAuthorOfDecision failed", err);
  }
}

export async function submitReview(
  unsafeData: CreateReviewInput,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = createReviewSchema.safeParse(unsafeData, { error: await getServerZodErrorMap() });

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const userId = await resolveUserId();
    await enforceRateLimit("review", userId);
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

    const created = await createReview({ productId, userId, orderId, rating, comment });
    await applyModeration(created.id, rating, comment);
  } catch (error) {
    return handleActionError(error);
  }
}

export async function updateReview(
  unsafeData: UpdateReviewInput,
): Promise<void | ActionErrorResult> {
  try {
    const parsed = updateReviewSchema.safeParse(unsafeData, { error: await getServerZodErrorMap() });

    if (!parsed.success) {
      return {
        error: true,
        message: parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const userId = await resolveUserId();
    await enforceRateLimit("review", userId);
    const { reviewId, rating, comment } = parsed.data;

    const result = await dbUpdateReview({ reviewId, userId, rating, comment });
    if (!result) {
      throw new NotFoundError("Review not found");
    }

    // Re-moderate only when the comment text changed (a rating-only edit keeps
    // its existing decision - nothing new to moderate).
    if (result.commentChanged) {
      await applyModeration(reviewId, rating, comment);
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
    await enforceRateLimit("review", userId);

    const result = await dbDeleteReview(reviewId, userId);
    if (!result) {
      throw new NotFoundError("Review not found");
    }
  } catch (error) {
    return handleActionError(error);
  }
}

/**
 * Admin manual moderation: approve or reject a review from the moderation queue.
 * Returns a result (inline row action - must not redirect) and records an audit
 * entry for the human decision.
 */
export async function moderateReviewAction(
  unsafe: ModerateReviewInput,
): Promise<{ ok: true } | ActionErrorResult> {
  try {
    await requireRole("ADMIN");
    const parsed = moderateReviewSchema.safeParse(unsafe, { error: await getServerZodErrorMap() });
    if (!parsed.success) {
      return { error: true, message: parsed.error.issues.map((i) => i.message).join(", ") };
    }

    const { reviewId, status, reason } = parsed.data;
    const result = await setReviewModeration(reviewId, status, reason ?? null);
    if (!result) {
      throw new NotFoundError("Review not found");
    }

    await recordAudit({
      action: status === "APPROVED" ? "review.approved" : "review.rejected",
      entityType: "Review",
      entityId: reviewId,
      diff: reason ? { reason } : undefined,
    });

    // Notify the author of the decision (their locale). Recipient-targeted and
    // best-effort: a notification failure must never fail the moderation.
    await notifyAuthorOfDecision(reviewId, status, reason ?? null);

    revalidatePath("/[locale]/admin/reviews", "page");
    return { ok: true };
  } catch (error) {
    return handleActionError(error);
  }
}
