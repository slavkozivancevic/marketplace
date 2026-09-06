import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { logger } from "@/lib/logger";
import { recordDbQuery } from "@/lib/observability/requestContext";
import { isAfterIdleGap, isWithinColdTail, COLD_TAIL_MS } from "@/lib/observability/idleGap";
import { isReadOperation, isTransientDbError, RETRY_DELAYS_MS } from "./transientErrors";

/**
 * A query slower than this is worth a line in the log. Too low and the warning
 * becomes background noise nobody reads; too high and the regression that
 * matters never surfaces.
 *
 * The number has to differ by environment because the floor does. In
 * production the app is a Lambda sitting in the same region as Neon, so the
 * round trip is single-digit milliseconds and 200ms genuinely means the query
 * is doing too much work. Locally the app runs on a laptop and Neon is across
 * the internet: EVERY query pays that WAN round trip, and measured on this
 * machine an ordinary indexed read lands at 220-470ms with a `groupBy` at
 * 730ms. At 200ms the dev console filled with `slow_query` warnings that no
 * amount of query tuning could remove - the exact "wall of yellow trains the
 * eye to ignore the level that matters" failure that the cold-start split
 * below was written to fix, arriving from the other direction.
 *
 * 1s in development therefore sits above the network floor and still catches a
 * genuine problem, which shows up as multiple seconds. The per-request query
 * COUNT (`recordDbQuery`) is the signal for N+1 patterns in dev, and it is
 * unaffected by this threshold.
 *
 * Production stays at 200ms - a starting point rather than a measurement,
 * to be recalibrated once staging has produced real numbers (ROADMAP #23).
 */
const SLOW_QUERY_MS = process.env.NODE_ENV === "development" ? 1_000 : 200;

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

/**
 * How long after a new pool connection is opened a slow query is attributed to
 * that handshake rather than to the query itself. The query that paid for the
 * connection finishes microseconds after the `connect` event, so this only has
 * to span one query - two seconds is generous and still far too short to
 * absorb a real regression.
 */
const CONNECT_TAIL_MS = 2_000;

/** Set when the pool opens a connection; see `connecting` below. */
let connectedUntil = 0;

/**
 * The pool is constructed here rather than letting the adapter own one,
 * specifically so `connect` can be observed.
 *
 * Measured locally: opening a connection costs ~300ms, while the query that
 * follows it costs 5ms. The idle-gap heuristic cannot see this - it asks "how
 * long since the previous query", and a request that runs several queries
 * through `Promise.all` makes the pool open extra connections while the
 * previous query finished milliseconds ago. The result was
 * `slow_query Membership.findUnique 256ms` for a lookup that takes 5ms, which
 * is the same false signal `idleGap.ts` exists to prevent, arriving by a
 * different route.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  // node-pg does not pre-open these (measured: the pool is empty until the
  // first query), but it does keep this many alive past `idleTimeoutMillis`
  // instead of reaping them - measured at 1 surviving connection with min=2
  // versus 0 with the default. That is what stops the reconnect churn between
  // requests, where every page load paid a fresh ~300ms handshake. Two covers
  // the parallel reads a single request makes through `Promise.all`.
  min: 2,
});
pool.on("connect", () => {
  connectedUntil = Date.now() + CONNECT_TAIL_MS;
});

const adapter = new PrismaPg(pool);

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
        const connecting = issuedAt < connectedUntil;
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

            // A connection was opened while this query was in flight, so the
            // handshake is inside the measured duration. Reported separately:
            // it is neither a slow query nor a database resume, and tuning the
            // query would do nothing about it.
            const connectionWait = !cold && (connecting || issuedAt < connectedUntil);

            // `idleMs` is the evidence behind the label - null on the very
            // first query of a process. Logging it keeps the classification
            // auditable instead of asking anyone to trust the heuristic.
            //
            // `model` is undefined for raw queries ($queryRaw / $executeRaw).
            // Three different events, only one of which is a problem:
            //
            //   slow_query       a query worth optimising -> warn
            //   db_cold_start    the database was asleep and this query paid
            //                    for the resume -> warn, it is a real latency
            //                    event a user felt
            //   db_first_query   `idleMs` is null: nothing was asleep, this is
            //                    simply the first query of a fresh process
            //                    (a dev-server restart, a new Lambda). It is
            //                    slow by definition and there is nothing to
            //                    fix -> debug
            //   db_connect_wait  the pool opened a connection mid-query, so the
            //                    handshake is inside the measurement. Also
            //                    nothing to fix -> debug
            //
            // The last two used to be warnings, which put a wall of yellow in
            // the console on every restart and trained the eye to ignore the
            // level that does matter.
            const processStart = cold && idleMs === null;
            const event = processStart
              ? "db_first_query"
              : cold
              ? "db_cold_start"
              : connectionWait
              ? "db_connect_wait"
              : "slow_query";
            const payload = {
              model: model ?? "raw",
              operation,
              durationMs,
              idleMs,
            };
            if (event === "db_first_query" || event === "db_connect_wait") {
              logger.debug(event, payload);
            } else {
              logger.warn(event, payload);
            }
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
