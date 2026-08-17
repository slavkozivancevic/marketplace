import { Prisma } from "@/generated/prisma/client";

/**
 * Runs a create `attempt` without a slug/key suffix first, so a brand-new
 * record gets the clean, human-typed slug whenever it's actually free. Only
 * retries - once, with a short always-unique timestamp suffix - when the
 * unsuffixed attempt collides on the underlying unique index, instead of
 * unconditionally suffixing every new slug "just in case" (which is what
 * produced ugly slugs like `product-title-msvfrb5o` even when `product-title`
 * was free).
 *
 * `attempt` must be fully retryable: on the collision path it re-runs from
 * scratch with a suffix, so it should live inside its own transaction (or
 * otherwise have no side effect that isn't safe to redo).
 */
export async function createWithUniqueSlugRetry<T>(
  attempt: (suffix?: string) => Promise<T>,
): Promise<T> {
  try {
    return await attempt(undefined);
  } catch (err) {
    if (!isUniqueConstraintViolation(err)) throw err;
    return await attempt(Date.now().toString(36));
  }
}

/**
 * Any unique-constraint violation triggers the retry - deliberately NOT just
 * ones whose reported target looks slug-ish.
 *
 * `meta.target` is not a dependable signal: depending on the driver and Prisma
 * version it arrives as a field array (`["locale","slug"]`), as the constraint
 * name (`"ProductTranslation_locale_slug_key"`), or missing entirely. Matching
 * on its contents meant a real slug collision could go unrecognised and surface
 * to the admin as a raw "already exists" error, which is exactly what the retry
 * exists to prevent.
 *
 * Retrying on any P2002 is safe: the second attempt only differs by the slug
 * suffix, so a collision on some other column simply fails again and is
 * rethrown - one extra round trip in a case that was already an error, and each
 * attempt is its own transaction, so nothing is left half-written.
 */
function isUniqueConstraintViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}
