/**
 * Fails when `prisma/migrations/` and `prisma/schema.prisma` disagree.
 *
 * WHY THIS EXISTS. On 2026-08-07 a migration added `Tag.updatedAt` as NOT NULL
 * to a table that already had rows, so Prisma emitted `DEFAULT CURRENT_TIMESTAMP`
 * to backfill them - and left the default behind. schema.prisma never declared
 * it. Nothing failed, nothing was logged, and the two drifted apart for sixteen
 * days. It surfaced only because the next migration anyone generated silently
 * folded an unrelated `ALTER TABLE` into itself.
 *
 * That is the failure mode worth engineering against: not the default itself,
 * but a divergence that no build, test or review can see. This check replays the
 * migration history into a scratch database and diffs the result against the
 * schema, so the PR that introduces drift is the PR that goes red.
 *
 * Reads nothing from the real database - only the migration files, the schema,
 * and a throwaway shadow database it resets.
 */
import "dotenv/config";
import { spawnSync } from "node:child_process";
import pg from "pg";

const SHADOW_DB_NAME = "prisma_drift_shadow";

function resolveShadowUrl() {
  const explicit = process.env.SHADOW_DATABASE_URL;
  if (explicit) return explicit;

  const base = process.env.DATABASE_URL;
  if (!base) {
    console.error(
      "Neither SHADOW_DATABASE_URL nor DATABASE_URL is set - nothing to derive a shadow database from.",
    );
    process.exit(1);
  }
  // Same server, dedicated scratch database. Never the dev/stage database:
  // Prisma RESETS whatever the shadow URL points at.
  const url = new URL(base);
  url.pathname = `/${SHADOW_DB_NAME}`;
  return url.toString();
}

/** Prisma needs the shadow database to exist; it will handle resetting it. */
async function ensureShadowDatabase(shadowUrl) {
  const adminUrl = new URL(shadowUrl);
  const name = adminUrl.pathname.slice(1);
  adminUrl.pathname = "/postgres";

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (rowCount === 0) {
      // Identifier cannot be parameterised; the name is a constant above.
      await client.query(`CREATE DATABASE "${name}"`);
      console.log(`Created shadow database "${name}".`);
    }
  } finally {
    await client.end();
  }
}

const shadowUrl = resolveShadowUrl();
await ensureShadowDatabase(shadowUrl);

// --exit-code: 0 = identical, 2 = differences, 1 = the command itself failed.
const result = spawnSync(
  "npx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-migrations",
    "./prisma/migrations",
    "--to-schema",
    "./prisma/schema.prisma",
    "--exit-code",
  ],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, SHADOW_DATABASE_URL: shadowUrl },
  },
);

if (result.status === 0) {
  console.log("\nNo drift: the migration history reproduces schema.prisma exactly.");
  process.exit(0);
}

if (result.status === 2) {
  console.error(
    [
      "",
      "MIGRATION DRIFT: applying prisma/migrations does not reproduce schema.prisma.",
      "The differences are listed above.",
      "",
      "Fix it by making the two agree, not by suppressing this check:",
      "  - schema.prisma is right  -> generate a migration for the difference",
      "      npx prisma migrate dev --create-only --name <what_it_does>",
      "  - the database shape is right -> correct schema.prisma to match",
      "",
      "Do not let the difference ride along inside an unrelated migration - that",
      "is exactly how it stayed hidden last time.",
    ].join("\n"),
  );
  process.exit(1);
}

console.error(`\nprisma migrate diff failed (exit ${result.status}).`);
process.exit(1);
