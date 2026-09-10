/**
 * Runs the money backfill TOOL against a deployed stage's database.
 *
 * NOT part of the deploy: the backfill itself is a migration
 * (prisma/migrations/20260906120000_backfill_money_sets), which the pipeline
 * already applies exactly once. This is the operator's entry point for the
 * cases that come after it - verifying the result, or repairing rows that
 * arrived later from a restored dump or a manual INSERT.
 *
 * All it adds is resolving the stage's DIRECT database URL; see
 * scripts/lib/stageDatabaseUrl.mjs for why `sst shell` cannot be trusted here.
 *
 * Usage: node scripts/backfill-money-stage.mjs --stage staging [--verify|--dry-run]
 */
import { spawnSync } from "node:child_process";
import { resolveStageDatabaseUrl } from "./lib/stageDatabaseUrl.mjs";

const args = process.argv.slice(2);
const stageIdx = args.indexOf("--stage");
const stage = stageIdx !== -1 ? args[stageIdx + 1] : null;
if (!stage) {
  console.error("Usage: node scripts/backfill-money-stage.mjs --stage <stage> [--dry-run]");
  process.exit(1);
}

let directUrl;
try {
  directUrl = resolveStageDatabaseUrl(stage);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const passThrough = ["--dry-run", "--verify"].filter((f) => args.includes(f));

console.log(`Running the money backfill tool against stage "${stage}" (direct connection)...`);
// `tsx` is a pinned devDependency, so this resolves from node_modules rather
// than fetching an unpinned version at build time.
const result = spawnSync("npx", ["tsx", "scripts/backfill-money-sets.ts", ...passThrough], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: directUrl },
});
process.exit(result.status ?? 1);
