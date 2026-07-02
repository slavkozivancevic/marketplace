import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config. Specs live in `e2e/`. The runner boots the app itself
 * (`webServer`) and reuses an already-running dev server locally, so `npm run
 * test:e2e` works whether or not the app is already up.
 *
 * Scope: public storefront journeys (no auth / no payment). The authenticated
 * checkout journey needs Clerk test users + Stripe test mode - a follow-up wired
 * alongside CI (see TESTING.md).
 */
const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
