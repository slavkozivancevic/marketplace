import { getTranslations } from "next-intl/server";
import { ActionErrorResult } from "@/types/types";
import { Prisma } from "@/generated/prisma/client";

export { isActionErrorResult } from "./actionErrorResult";

/**
 * Translation payload carried on each domain error so `handleActionError` can
 * surface a localized message in the toast layer. The `key` resolves against
 * the `actionErrors` namespace in messages/*.json.
 *
 * Constructors keep accepting a legacy English string for backwards
 * compatibility with deep DB / service-level throws - those fall back to the
 * class's default key (their original message stays on `.message` for logs).
 */
export type ErrorI18n = {
  key: string;
  params?: Record<string, string | number>;
};

function normalizeI18n(
  arg: string | ErrorI18n | undefined,
  defaultKey: string,
  defaultMessage: string,
): { i18n: ErrorI18n; message: string } {
  if (arg == null) {
    return { i18n: { key: defaultKey }, message: defaultMessage };
  }
  if (typeof arg === "string") {
    return { i18n: { key: defaultKey }, message: arg };
  }
  return { i18n: arg, message: arg.key };
}

export class ForbiddenError extends Error {
  readonly i18n: ErrorI18n;
  constructor(arg: string | ErrorI18n = "Forbidden") {
    const { i18n, message } = normalizeI18n(arg, "forbidden", "Forbidden");
    super(message);
    this.i18n = i18n;
    this.name = "ForbiddenError";
  }
}

export class OrganizationNotVerifiedError extends Error {
  readonly i18n: ErrorI18n;
  constructor(arg: string | ErrorI18n = "Organization is not verified") {
    const { i18n, message } = normalizeI18n(
      arg,
      "organizationNotVerified",
      "Organization is not verified",
    );
    super(message);
    this.i18n = i18n;
    this.name = "OrganizationNotVerifiedError";
  }
}

export class ConcurrencyConflictError extends Error {
  readonly i18n: ErrorI18n;
  constructor(arg: string | ErrorI18n = "This record was modified by another user.") {
    const { i18n, message } = normalizeI18n(
      arg,
      "concurrencyConflict",
      "This record was modified by another user.",
    );
    super(message);
    this.i18n = i18n;
    this.name = "ConcurrencyConflictError";
  }
}

export class BulkLimitExceededError extends Error {
  readonly i18n: ErrorI18n;
  constructor(arg: string | ErrorI18n = "Bulk operation exceeds the allowed limit") {
    const { i18n, message } = normalizeI18n(
      arg,
      "bulkLimitExceeded",
      "Bulk operation exceeds the allowed limit",
    );
    super(message);
    this.i18n = i18n;
    this.name = "BulkLimitExceededError";
  }
}

export class InsufficientStockError extends Error {
  readonly i18n: ErrorI18n;
  constructor(arg: string | ErrorI18n = "Insufficient stock") {
    const { i18n, message } = normalizeI18n(
      arg,
      "insufficientStock",
      "Insufficient stock",
    );
    super(message);
    this.i18n = i18n;
    this.name = "InsufficientStockError";
  }
}

export class TooManyRequestsError extends Error {
  readonly i18n: ErrorI18n;
  constructor(arg: string | ErrorI18n = "Too many requests") {
    const { i18n, message } = normalizeI18n(
      arg,
      "tooManyRequests",
      "Too many requests",
    );
    super(message);
    this.i18n = i18n;
    this.name = "TooManyRequestsError";
  }
}

export class NotFoundError extends Error {
  readonly i18n: ErrorI18n;
  constructor(arg: string | ErrorI18n = "Not found") {
    const { i18n, message } = normalizeI18n(arg, "notFound", "Not found");
    super(message);
    this.i18n = i18n;
    this.name = "NotFoundError";
  }
}

export class VersionRequiredError extends Error {
  readonly i18n: ErrorI18n;
  constructor(
    arg: string | ErrorI18n = "Valid version is required for concurrency safety",
  ) {
    const { i18n, message } = normalizeI18n(
      arg,
      "versionRequired",
      "Valid version is required for concurrency safety",
    );
    super(message);
    this.i18n = i18n;
    this.name = "VersionRequiredError";
  }
}

export class UnauthenticatedError extends Error {
  readonly i18n: ErrorI18n;
  constructor(arg: string | ErrorI18n = "Unauthenticated") {
    const { i18n, message } = normalizeI18n(
      arg,
      "unauthenticated",
      "Unauthenticated",
    );
    super(message);
    this.i18n = i18n;
    this.name = "UnauthenticatedError";
  }
}

export class MembershipNotFoundError extends Error {
  readonly i18n: ErrorI18n;
  constructor(arg: string | ErrorI18n = "Membership not found") {
    const { i18n, message } = normalizeI18n(
      arg,
      "membershipNotFound",
      "Membership not found",
    );
    super(message);
    this.i18n = i18n;
    this.name = "MembershipNotFoundError";
  }
}

export class ImageProcessorError extends Error {
  readonly i18n: ErrorI18n;
  constructor(arg: string | ErrorI18n) {
    const { i18n, message } = normalizeI18n(
      arg,
      "imageProcessingFailed",
      "Image processing failed",
    );
    super(message);
    this.i18n = i18n;
    this.name = "ImageProcessorError";
  }
}

export class VideoProcessorError extends Error {
  readonly i18n: ErrorI18n;
  constructor(arg: string | ErrorI18n) {
    const { i18n, message } = normalizeI18n(
      arg,
      "videoProcessingFailed",
      "Video processing failed",
    );
    super(message);
    this.i18n = i18n;
    this.name = "VideoProcessorError";
  }
}

type WithI18n = { i18n: ErrorI18n };
function hasI18n(error: unknown): error is WithI18n {
  return (
    typeof error === "object" &&
    error !== null &&
    "i18n" in error &&
    typeof (error as { i18n: unknown }).i18n === "object"
  );
}

export async function handleActionError(error: unknown): Promise<ActionErrorResult> {
  const t = await getTranslations("actionErrors");

  if (hasI18n(error)) {
    return { error: true, message: t(error.i18n.key, error.i18n.params) };
  }

  // Unique constraint violation - surface a readable message instead of the
  // generic fallback so users know the value already exists.
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = (error.meta as { target?: unknown } | undefined)?.target;
    const fields = Array.isArray(target)
      ? target.filter((f): f is string => typeof f === "string").join(", ")
      : typeof target === "string"
        ? target
        : "";
    const message = fields
      ? t("uniqueConstraint", { fields })
      : t("uniqueConstraintNoFields");
    return { error: true, message };
  }

  // Unexpected error: the toast only ever shows the generic `internalError`
  // string, so without this log the real cause (Prisma code, FK target, stack)
  // is lost. Log it server-side so failures stay diagnosable from the terminal.
  console.error("[handleActionError] unexpected error:", error);
  return { error: true, message: t("internalError") };
}