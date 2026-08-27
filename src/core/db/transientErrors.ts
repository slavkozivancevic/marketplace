/**
 * Decides whether a failed query is worth trying again.
 *
 * WHY THIS EXISTS. Neon's Free plan suspends the compute after five minutes and
 * the setting cannot be turned off. Usually the first query afterwards simply
 * blocks for a few seconds while the compute resumes and then succeeds - that
 * is the `db_cold_start` signal. Sometimes it does not: the connection is
 * refused or dropped mid-resume, Prisma throws, the Server Component render
 * throws with it, and the visitor gets a 500. Measured on staging, unmatched
 * paths answered 307 six times out of six while warm and failed only when cold.
 *
 * So the first visitor after a quiet spell could be served an error page for a
 * database that was merely waking up. One retry turns that into the slow page
 * it should have been.
 *
 * READS ONLY, DELIBERATELY. A connection error usually means the statement
 * never ran, but "usually" is not good enough for a write: the connection can
 * also drop *after* the server committed, and a retried `create` would then
 * duplicate an order. Reads are idempotent by definition and cover the case
 * that actually hurts - a page render is nothing but reads.
 */

/** Prisma error codes that describe reaching the server, not the query. */
const TRANSIENT_PRISMA_CODES = new Set([
  "P1001", // can't reach database server
  "P1002", // server reached but timed out
  "P1008", // operation timed out
  "P1017", // server has closed the connection
]);

/**
 * Driver-level failures surface through the pg adapter without a Prisma code,
 * so the message is all there is to match on. Kept to phrases that can only
 * describe a transport failure - nothing here can match a constraint violation
 * or a bad query.
 */
const TRANSIENT_MESSAGE_RE =
  /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|connection terminated|connection closed|Connection terminated unexpectedly|server closed the connection|Can't reach database server|timeout expired/i;

const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

export function isReadOperation(operation: string): boolean {
  return READ_OPERATIONS.has(operation);
}

export function isTransientDbError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const err = error as { name?: string; code?: string; message?: string };

  if (err.code && TRANSIENT_PRISMA_CODES.has(err.code)) return true;

  // Thrown when the client cannot establish a connection at all - exactly the
  // shape of a compute that has not finished resuming.
  if (err.name === "PrismaClientInitializationError") return true;

  return typeof err.message === "string" && TRANSIENT_MESSAGE_RE.test(err.message);
}

/**
 * Backoff for the retries. Two attempts spanning ~1.5s, sized against the
 * measured resume: cold queries on staging took 0.7-3.3s and the ones that
 * blocked rather than failed all succeeded, so a second attempt lands while the
 * compute is up. Deliberately short - this sits in a user's request, and a
 * database that is genuinely down should fail fast rather than hold the page.
 */
export const RETRY_DELAYS_MS = [300, 1200];
