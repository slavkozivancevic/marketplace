/**
 * Runs `prisma migrate deploy` against a real (non-local) stage's database -
 * the safe replacement for the `npx sst shell --stage <stage> -- npx prisma
 * migrate deploy` step in AWS-SETUP.md, which does NOT work for this app.
 *
 * Root cause: `sst shell` only exposes linked secrets via the
 * `SST_RESOURCES_JSON` env var (for consumption through `Resource.<Name>.value`
 * from the `sst` package) - it does not map `sst.Secret("DatabaseUrl")` to a
 * raw `process.env.DATABASE_URL`. This app reads secrets as plain
 * `process.env.DATABASE_URL` (see prisma.config.ts / env/server.ts), so that
 * var falls through to whatever the local `.env` already sets - silently
 * migrating your LOCAL database while believing you targeted the stage.
 * (Verified 2026-07-28: `sst shell` also leaks stale/wrong values for
 * CLERK_WEBHOOK_SECRET etc. the same way - this is not DATABASE_URL-specific.)
 *
 * This script sidesteps `sst shell` entirely: it reads the secret directly
 * via `sst secret list --stage <stage>` and passes it explicitly, so nothing
 * ever falls back to the local .env by accident.
 *
 * Also swaps Neon's pooled endpoint for the direct one - Prisma's migration
 * engine needs a session-level connection, which the pgbouncer/pooler
 * endpoint doesn't support (advisory locks). Mirrors the manual
 * `DATABASE_URL=<direct-neon-url>` convention already used by scripts/staging/*.
 *
 * Usage: node scripts/migrate-stage.mjs --stage staging
 *        node scripts/migrate-stage.mjs --stage staging -- migrate status   (any prisma subcommand)
 */
import { spawnSync } from "node:child_process";
import { resolveStageDatabaseUrl } from "./lib/stageDatabaseUrl.mjs";

const args = process.argv.slice(2);
const stageIdx = args.indexOf("--stage");
const stage = stageIdx !== -1 ? args[stageIdx + 1] : null;
if (!stage) {
  console.error("Usage: node scripts/migrate-stage.mjs --stage <stage> [-- <prisma subcommand...>]");
  process.exit(1);
}

// Anything after a literal `--` overrides the default `migrate deploy`
// subcommand (e.g. `-- migrate status` for a read-only check first).
const dashIdx = args.indexOf("--");
const prismaArgs = dashIdx !== -1 ? args.slice(dashIdx + 1) : ["migrate", "deploy"];

let directUrl;
try {
  directUrl = resolveStageDatabaseUrl(stage);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

console.log(`Running "prisma ${prismaArgs.join(" ")}" against stage "${stage}" (direct connection)...`);
const result = spawnSync("npx", ["prisma", ...prismaArgs], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: directUrl },
});
process.exit(result.status ?? 1);
