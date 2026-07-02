import { logger } from "@/lib/logger";
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/env/server";
import type { ReviewStatus } from "@/generated/prisma/client";

/**
 * AI moderation for product reviews.
 *
 * Design (enterprise, $0-until-traffic):
 * - Pay-per-use only: one Claude Haiku call per submitted/edited review,
 *   ~$0.0006 each, no standing infrastructure.
 * - Graceful degradation: if ANTHROPIC_API_KEY is unset, the call fails, or the
 *   model is uncertain, we return PENDING so a human moderates it. A review is
 *   NEVER auto-published on uncertainty - false negatives cost nothing (an admin
 *   approves later), false positives (toxic content going live) are the risk we
 *   refuse to take.
 * - Three-way decision: clean -> APPROVED, clearly abusive/spam -> REJECTED,
 *   anything in between -> PENDING (manual review).
 */

export type ModerationResult = {
  status: ReviewStatus;
  /** Short human-readable reason; null when approved or no decision. */
  reason: string | null;
};

const MODEL = "claude-haiku-4-5";
// Hard ceiling so a slow/hung API call can never block a review submission for
// long; on timeout we fall back to PENDING.
const TIMEOUT_MS = 8000;

const SYSTEM_PROMPT = `You are a content moderation classifier for product reviews on an e-commerce marketplace. You receive a star rating (1-5) and an optional review comment. Decide whether the comment is acceptable for public display.

REJECT only clear violations:
- Hate speech, harassment, threats, or slurs
- Sexually explicit content
- Spam, advertising, scams, or links to other sites
- Personal data (phone numbers, emails, home addresses)
- Content entirely unrelated to a product review (gibberish, copy-paste junk)

APPROVE normal reviews, including harshly negative but legitimate ones. A low rating with honest criticism is fine. Profanity used as emphasis ("this is crap, broke in a day") is acceptable; targeted abuse is not.

REVIEW (uncertain) when you cannot confidently approve or reject - borderline tone, possible but unclear policy issues, or ambiguous intent.

Respond with ONLY a single JSON object, no prose, no code fences:
{"decision": "approve" | "reject" | "review", "reason": "<=120 chars, empty for approve"}`;

/** Maps the model's decision token to a moderation status. Unknown -> PENDING. */
function decisionToStatus(decision: string): ReviewStatus {
  if (decision === "approve") return "APPROVED";
  if (decision === "reject") return "REJECTED";
  return "PENDING";
}

/**
 * Classifies a review. Always resolves (never throws) - any failure path yields
 * PENDING so the underlying review submission is never blocked or lost.
 */
export async function moderateReview(input: {
  rating: number;
  comment?: string | null;
}): Promise<ModerationResult> {
  const comment = input.comment?.trim();
  // Rating-only reviews carry no text to moderate - always safe to auto-approve,
  // regardless of whether AI moderation is configured.
  if (!comment) return { status: "APPROVED", reason: null };

  const apiKey = env.ANTHROPIC_API_KEY;
  // Feature off (no key): hand off to manual moderation.
  if (!apiKey) return { status: "PENDING", reason: null };

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 256,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Rating: ${input.rating}/5\nComment: ${comment}`,
          },
        ],
      },
      { timeout: TIMEOUT_MS, maxRetries: 1 },
    );

    // Safety classifiers can decline; treat that as "needs human review".
    if (response.stop_reason === "refusal") {
      return { status: "PENDING", reason: null };
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const parsed = parseDecision(text);
    if (!parsed) return { status: "PENDING", reason: null };

    const status = decisionToStatus(parsed.decision);
    return {
      status,
      reason: status === "APPROVED" ? null : parsed.reason || null,
    };
  } catch (err) {
    logger.error("[aiModeration] moderateReview failed", err);
    return { status: "PENDING", reason: null };
  }
}

/** Tolerant JSON extraction: handles stray code fences or surrounding prose. */
function parseDecision(
  text: string,
): { decision: string; reason: string } | null {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as {
      decision?: unknown;
      reason?: unknown;
    };
    if (typeof obj.decision !== "string") return null;
    return {
      decision: obj.decision,
      reason: typeof obj.reason === "string" ? obj.reason : "",
    };
  } catch {
    return null;
  }
}
