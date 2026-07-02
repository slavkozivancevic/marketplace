import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `server-only` / `client-only` throw when resolved outside their bundler
// context; under the node runner they're no-ops, so alias them to an empty stub.
const emptyStub = fileURLToPath(new URL("./test/stubs/empty.ts", import.meta.url));

/**
 * Vitest config - the default (unit) test run.
 *
 * Test tiers and their file conventions (see TESTING.md for the full standard):
 *   - Unit         `*.test.ts`              pure logic, no DB/network, node env
 *   - Integration  `*.integration.test.ts`  real test DB, opt-in (own config)
 *   - E2E          `e2e/*.spec.ts`          Playwright (own runner)
 *
 * This config runs ONLY unit tests: fast, deterministic, no external services,
 * so `npm test` stays instant and CI-safe. Integration and E2E have their own
 * runners so a missing test DB / browser never breaks the unit run.
 */
export default defineConfig({
  resolve: {
    // Native tsconfig `paths` resolution (@/* -> src/*), no plugin needed.
    tsconfigPaths: true,
    alias: {
      "server-only": emptyStub,
      "client-only": emptyStub,
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: [
      "**/node_modules/**",
      "**/*.integration.test.*",
      "e2e/**",
    ],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "html"],
      // Coverage reflects only what unit tests exercise (pure domain logic);
      // routes/components/db are covered by integration + e2e tiers.
      include: ["src/lib/**", "src/features/**/utils/**", "src/services/**"],
    },
  },
});
