import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { logger } from "@/lib/logger";
import { recordDbQuery } from "@/lib/observability/requestContext";
import { isAfterIdleGap } from "@/lib/observability/idleGap";

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
        const cold = isAfterIdleGap(lastQueryEndedAt, Date.now());
        const startedAt = performance.now();
        try {
          return await query(args);
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
            // `model` is undefined for raw queries ($queryRaw / $executeRaw).
            logger.warn(cold ? "db_cold_start" : "slow_query", {
              model: model ?? "raw",
              operation,
              durationMs,
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
