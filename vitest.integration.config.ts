import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";

/**
 * Integration test config - runs ONLY `*.integration.test.ts` against a real
 * (throwaway) Postgres. Kept separate from the unit config so a missing test DB
 * never breaks `npm test`.
 *
 * The test DB URL comes from `.env.test` (see `.env.test.example`). We load it
 * here, before any app module reads `process.env.DATABASE_URL`, and skip the
 * full env validation so integration runs don't need every production secret.
 */
loadEnv({ path: ".env.test", override: true });
process.env.SKIP_ENV_VALIDATION = "1";

const stub = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // Without this, next-intl/server's conditional export falls back to its
    // react-client build (no "react-server" condition set), which throws
    // "getTranslations is not supported in Client Components" the moment a
    // server action under test calls handleActionError -> getTranslations.
    conditions: ["react-server"],
    alias: {
      "server-only": stub("./test/stubs/empty.ts"),
      "client-only": stub("./test/stubs/empty.ts"),
      // The Next cache primitives have no request context under the test runner.
      "next/cache": stub("./test/stubs/nextCache.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts", "test/**/*.integration.test.ts"],
    globalSetup: ["./test/integration/globalSetup.ts"],
    // One shared database - never run integration files in parallel.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
