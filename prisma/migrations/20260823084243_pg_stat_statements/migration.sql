-- CreateExtension
-- Query-cost telemetry (ROADMAP #23). Declared in schema.prisma's datasource
-- because `postgresqlExtensions` is enabled and Prisma drops any extension it
-- does not know about. Already present on staging (created by hand); this makes
-- local and every future stage match.
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
