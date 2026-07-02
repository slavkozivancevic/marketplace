import { execSync } from "node:child_process";

/**
 * Runs once before the integration suite. Two jobs:
 *  1. Safety guard - refuse to run unless DATABASE_URL points at a database
 *     whose name contains "test", so integration tests can never truncate the
 *     dev/prod database.
 *  2. Apply the current schema to the (already-created) test database via
 *     `prisma migrate deploy`.
 */
export default function setup(): void {
  const url = process.env.DATABASE_URL ?? "";

  let dbName = "";
  try {
    dbName = new URL(url).pathname.replace(/^\//, "");
  } catch {
    // fall through to the guard below
  }

  if (!/test/i.test(dbName)) {
    throw new Error(
      `Refusing to run integration tests: DATABASE_URL database name ("${dbName}") must contain "test". ` +
        `Point it at a throwaway DB in .env.test (see .env.test.example).`,
    );
  }

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: process.env,
  });
}
