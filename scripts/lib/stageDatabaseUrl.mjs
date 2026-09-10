import { execFileSync } from "node:child_process";

/**
 * Resolves a stage's DIRECT database URL from its SST secret.
 *
 * Two traps this exists to avoid, both previously hit for real:
 *
 * - `sst shell -- <cmd>` does NOT map `sst.Secret("DatabaseUrl")` to a raw
 *   `DATABASE_URL`. It only exposes secrets through `SST_RESOURCES_JSON`, so
 *   anything reading `process.env.DATABASE_URL` silently falls through to the
 *   local `.env` and targets your LOCAL database while looking like it worked.
 * - Neon's pooled (pgbouncer) endpoint does not support session-level
 *   advisory locks, which Prisma's migration engine needs. The `-pooler`
 *   segment is stripped so migrations and long-running backfills get a real
 *   session.
 *
 * Shared by every script that has to touch a deployed stage's database, so the
 * handling can never drift between them.
 */
export function resolveStageDatabaseUrl(stage) {
  let secretsOutput;
  try {
    secretsOutput = execFileSync("npx", ["sst", "secret", "list", "--stage", stage], {
      encoding: "utf8",
      shell: process.platform === "win32",
    });
  } catch (err) {
    throw new Error(`Failed to read secrets for stage "${stage}": ${err.message}`);
  }

  const match = secretsOutput.match(/^DatabaseUrl=(.+)$/m);
  if (!match) {
    throw new Error(
      `No DatabaseUrl secret set for stage "${stage}". ` +
        `Set it first: npx sst secret set DatabaseUrl <url> --stage ${stage}`,
    );
  }

  const pooledUrl = match[1].trim();
  const directUrl = pooledUrl.replace(/-pooler(?=\.)/, "");
  if (directUrl === pooledUrl) {
    console.warn(
      `Note: "${stage}"'s DatabaseUrl had no "-pooler" segment to strip - using it as-is.`,
    );
  }
  return directUrl;
}
