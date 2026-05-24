import { ActionErrorResult } from "@/types/types";
import { Prisma } from "@/generated/prisma/client";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class OrganizationNotVerifiedError extends Error {
  constructor() {
    super("Organization is not verified");
    this.name = "OrganizationNotVerifiedError";
  }
}

export class ConcurrencyConflictError extends Error {
  constructor() {
    super("This record was modified by another user.");
    this.name = "ConcurrencyConflictError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class VersionRequiredError extends Error {
  constructor(message = "Valid version is required for concurrency safety") {
    super(message);
    this.name = "VersionRequiredError";
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = "Unauthenticated") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class MembershipNotFoundError extends Error {
  constructor(message = "Membership not found") {
    super(message);
    this.name = "MembershipNotFoundError";
  }
}

export class ImageProcessorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageProcessorError";
  }
}

export class VideoProcessorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VideoProcessorError";
  }
}

export function handleActionError(error: unknown): ActionErrorResult {
  if (error instanceof ForbiddenError) {
    return { error: true, message: error.message };
  }

  if (error instanceof OrganizationNotVerifiedError) {
    return { error: true, message: error.message };
  }

  if (error instanceof ConcurrencyConflictError) {
    return { error: true, message: error.message };
  }

  if (error instanceof NotFoundError) {
    return { error: true, message: error.message };
  }

  if (error instanceof VersionRequiredError) {
    return { error: true, message: error.message };
  }

  if (error instanceof UnauthenticatedError) {
    return { error: true, message: error.message };
  }

  if (error instanceof MembershipNotFoundError) {
    return { error: true, message: error.message };
  }

  if (error instanceof ImageProcessorError) {
    return { error: true, message: error.message };
  }

  if (error instanceof VideoProcessorError) {
    return { error: true, message: error.message };
  }

  // Unique constraint violation - surface a readable message instead of the
  // generic "Internal error" fallback so users know the value already exists.
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = (error.meta as { target?: unknown } | undefined)?.target;
    const fields = Array.isArray(target)
      ? target.filter((f): f is string => typeof f === "string").join(", ")
      : typeof target === "string"
        ? target
        : "";
    const message = fields
      ? `A record with this ${fields} already exists.`
      : "A record with these values already exists.";
    return { error: true, message };
  }

  return { error: true, message: "Internal error" };
}

export function isActionErrorResult(
  result: unknown,
): result is { error: true; message: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    (result as { error: unknown }).error === true
  );
}
