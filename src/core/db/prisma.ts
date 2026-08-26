import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { logger } from "@/lib/logger";
import { recordDbQuery } from "@/lib/observability/requestContext";
import { isAfterIdleGap, isWithinColdTail, COLD_TAIL_MS } from "@/lib/observability/idleGap";
import { isReadOperation, isTransientDbError, RETRY_DELAYS_MS } from "./transientErrors";

/**
 * A query slower than this is worth a line in the log. 200ms is a starting
 * point, not a measurement - recalibrate once staging has produced real
 * numbers (ROADMAP #23). Too low and the warning becomes background noise
 * nobody reads; too high and the regression that matters never surfaces.
 */
const SLOW_QUERY_MS = 200;

/**
 * When the previous query in this process finished. Module scope, so it
 * survives across invocations for as long as the Lambda container does - which
 * is exactly the lifetime over which "has the database gone to sleep?" is a
 * meaningful question. See `idleGap.ts` for why this matters.
 */
let lastQueryEndedAt: number | undefined;

/**
 * Timestamp until which queries are still considered part of a resume. Extended
 * every time a slow query is attributed to one, so a cluster of warm-up queries
 * stays labelled as what it is instead of only its first member.
 */
let coldUntil = 0;

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

/**
 * Every query passes through here, which is the entire point: one seam gives
 * per-request query counts (the N+1 signal) and slow-query visibility without a
 * single call site knowing about it.
 *
 * Deliberately Prisma-level, not SQL-level. This records *which model and
 * operation* was slow, which is enough to find the offending call in the code;
 * `pg_stat_statements` on Neon is the place to go for the SQL text and the
 * plan. It also keeps query parameters - and therefore customer PII - out of
 * CloudWatch entirely, which Prisma's own `log: ["query"]` event would not.
 */
function createPrismaClient() {
  return new PrismaClient({ adapter }).$extends({
    name: "observability",
    query: {
      async $allOperations({ model, operation, args, query }) {
        // Decided BEFORE the query runs: afterwards the gap is zero by
        // definition, because this query has just updated the marker.
        const issuedAt = Date.now();
        const idleMs = lastQueryEndedAt === undefined ? null : issuedAt - lastQueryEndedAt;
        const cold =
          isAfterIdleGap(lastQueryEndedAt, issuedAt) || isWithinColdTail(coldUntil, issuedAt);
        const startedAt = performance.now();
        try {
          // Retry loop, not a plain call: a read that fails because Neon is
          // still resuming becomes a 500 for whoever happened to arrive first,
          // and that is a waking database rather than a broken one. Writes are
          // never retried - see transientErrors.ts for why.
          for (let attempt = 0; ; attempt++) {
            try {
              return await query(args);
            } catch (error) {
              const canRetry =
                attempt < RETRY_DELAYS_MS.length &&
                isReadOperation(operation) &&
                isTransientDbError(error);
              if (!canRetry) throw error;

              const delayMs = RETRY_DELAYS_MS[attempt];
              logger.warn("db_retry", {
                model: model ?? "raw",
                operation,
                attempt: attempt + 1,
                delayMs,
                idleMs,
                cold,
                reason: ((error as { message?: string })?.message ?? "").slice(0, 120),
              });
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
          }
        } catch (error) {
          // A query that THROWS was previously invisible here - the block below
          // only ever reported slow ones. That gap cost us: staging returned
          // 500s on cold starts and the cause could not be identified, because
          // React masks Server Component errors in production ("the specific
          // message is omitted...") and the underlying database failure was
          // never logged anywhere.
          //
          // Deliberately name/code/truncated-message only. Prisma error text can
          // carry field names, and there is no reason to risk row values
          // reaching CloudWatch to diagnose a connection failure.
          const err = error as { name?: string; code?: string; message?: string };
          logger.error("db_query_failed", {
            model: model ?? "raw",
            operation,
            durationMs: Math.round(performance.now() - startedAt),
            idleMs,
            cold,
            errorName: err?.name ?? "Unknown",
            prismaCode: err?.code ?? null,
            reason: (err?.message ?? "").slice(0, 200),
          });
          throw error;
        } finally {
          const durationMs = Math.round(performance.now() - startedAt);
          lastQueryEndedAt = Date.now();
          // No-op outside an observed request (crons, build-time reads).
          recordDbQuery(durationMs);
          if (durationMs >= SLOW_QUERY_MS) {
            // Two different events wearing the same costume. `slow_query` is a
            // query worth optimising; `db_cold_start` is the price of Neon
            // resuming a suspended compute, which no amount of query tuning
            // will fix. Counting them together made the slow-query signal
            // useless - see idleGap.ts.
            //
            // A resume is a slow few seconds, not one slow query, so being
            // cold extends the window over the queries that follow it. Only a
            // slow one extends it: once queries come back fast the window
            // lapses on its own and the next genuine regression is visible.
            if (cold) coldUntil = lastQueryEndedAt + COLD_TAIL_MS;

            // `idleMs` is the evidence behind the label - null on the very
            // first query of a process. Logging it keeps the classification
            // auditable instead of asking anyone to trust the heuristic.
            //
            // `model` is undefined for raw queries ($queryRaw / $executeRaw).
            logger.warn(cold ? "db_cold_start" : "slow_query", {
              model: model ?? "raw",
              operation,
              durationMs,
              idleMs,
            });
          }
        }
      },
    },
  });
}

type ObservedPrismaClient = ReturnType<typeof createPrismaClient>;

/**
 * The `tx` handle handed to `prisma.$transaction(async (tx) => ...)`.
 *
 * Use this instead of Prisma's own built-in transaction-client type for any
 * helper that takes a transaction. That built-in describes a *plain* client,
 * and an extended client is a structurally different (incompatible) type - so
 * with the observability extension in place, passing a real `tx` to a parameter
 * typed with the built-in no longer compiles. Deriving the type from our own
 * client keeps the two in lockstep: add another extension later and every
 * signature follows automatically.
 *
 * The omitted members are the ones Prisma itself strips inside a transaction -
 * you cannot open a transaction within a transaction, or reconnect mid-flight.
 */
export type TransactionClient = Omit<
  ObservedPrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

const globalForPrisma = global as unknown as {
  prisma: ObservedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
