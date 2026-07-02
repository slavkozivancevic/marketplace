# Testing standard

The single source of truth for how tests are written and organized in this repo.
Follow it for every new test - consistency is the point.

## Tooling (modern, $0)

| Tier | Runner | Env | Purpose |
|---|---|---|---|
| **Unit** | Vitest 4 | node | Pure logic - no DB, no network, no framework |
| **Integration** | Vitest 4 | node | Server actions + Prisma against a real test DB |
| **E2E** | Playwright | browser | Full user journeys through the running app |

- **Vitest** (not Jest): ESM/TS-native, matches our `type: module` + bundler resolution.
- **`vite-tsconfig-paths`**: `@/*` imports resolve in tests exactly as in the app.
- **`@vitest/coverage-v8`**: native coverage (`npm run test:coverage`).
- **Playwright** (not Cypress): the modern cross-browser E2E standard.

## Commands

```bash
npm test               # unit tests, once (CI default) - fast, no external deps
npm run test:watch     # unit tests, watch mode
npm run test:coverage  # unit tests + V8 coverage report (./coverage)
npm run test:integration  # integration tests (needs a test DB - see below)
npm run test:e2e          # Playwright E2E (needs the app running + browsers)
```

## File location & naming (the convention)

- **Unit**: co-located next to the source, `foo.test.ts` beside `foo.ts`.
- **Integration**: `foo.integration.test.ts` (co-located or under `src/**`). Excluded
  from the default `npm test` run so a missing DB never breaks it.
- **E2E**: `e2e/<journey>.spec.ts`.

Unit is the default tier - the plain `npm test` run only ever touches `*.test.ts`.

## What goes in each tier

- **Unit** - deterministic, pure functions and small logic units. No mocking of
  things you can call directly. Targets: currency/pricing, `slugify`, permissions,
  CSV parse, JSON-LD builders, rate-limit windowing, moderation JSON parsing.
- **Integration** - a server action or db function end-to-end against a real
  (disposable) Postgres, asserting the persisted result. Targets: checkout, payout
  release, returns/refund math, stock guard, coupon usage, bulk ops.
- **E2E** - one real browser journey per spec: sign up -> create product -> search
  -> checkout -> review -> return.

## How a test file is written (the standard shape)

```ts
import { describe, it, expect } from "vitest";
import { decimalToCents } from "./currency";

describe("decimalToCents", () => {
  it("converts a decimal amount to integer cents", () => {
    expect(decimalToCents(29.99)).toBe(2999);
  });

  it("rounds sub-cent input to the nearest cent", () => {
    expect(decimalToCents(29.999)).toBe(3000);
  });
});
```

Rules, applied everywhere:

1. **Explicit imports** - always `import { describe, it, expect } from "vitest"`.
   No globals (keeps files self-contained and tsconfig untouched).
2. **One `describe` per unit** (function/class), named exactly after it. Group
   related units in one file matching the source module.
3. **One behavior per `it`**, phrased as a sentence: `it("throws when the role
   lacks the permission")`. Read `describe` + `it` together as English.
4. **Arrange / Act / Assert** - keep the three phases visible; comment only when
   the setup isn't obvious.
5. **Assert behavior, not implementation.** Prefer exact expected values.
6. **Deterministic** - no reliance on wall-clock time, real locale, randomness, or
   network. Use `vi.useFakeTimers()` / `vi.setSystemTime()` for time; use unique
   keys for shared module state (e.g. the rate-limiter store).
7. **Errors**: assert the type - `expect(() => fn()).toThrow(ForbiddenError)`.
8. **No snapshot tests** for logic - assert concrete values. Snapshots only for
   large stable structures where a diff is genuinely the clearest signal.

## Integration tests

Run against a **separate** Postgres (never the dev DB), driven by
`vitest.integration.config.ts` (`*.integration.test.ts` only) so this slow,
stateful tier stays out of the fast unit run.

Setup (once):

```bash
cp .env.test.example .env.test          # then edit DATABASE_URL -> a test DB
# create the DB (name MUST contain "test"): CREATE DATABASE marketplace_test;
npm run test:integration                # applies migrations, runs the suite
```

How it works:

- **`.env.test`** provides the test `DATABASE_URL`. The config loads it before any
  app module reads `process.env`, and sets `SKIP_ENV_VALIDATION` so integration
  runs don't need every production secret.
- **`test/integration/globalSetup.ts`** refuses to run unless the DB name contains
  `test` (so it can never truncate dev data), then runs `prisma migrate deploy`.
- **`next/cache`** and `server-only`/`client-only` are aliased to no-op stubs
  (`test/stubs/`) - the app's caching primitives have no request context here.
- **`test/integration/helpers.ts`** exports `resetDb()` (truncate all tables,
  call in `beforeEach`) and minimal fixtures (`createUser`, `createOrganization`,
  `createProduct`, `createVariant`, `createCoupon`).
- Integration files never run in parallel (`fileParallelism: false`) - one shared DB.

Test the **db-layer functions** (`createCodOrder`, `validateCoupon`, ...), not the
server *actions* that wrap them - actions depend on Clerk auth / cookies / i18n
request context that isn't worth faking. The db layer is where the logic lives.

## E2E tests

Playwright, specs in `e2e/*.spec.ts`, driven by `playwright.config.ts`.

```bash
npx playwright install chromium   # once - downloads the browser
npm run test:e2e                  # boots the app (or reuses a running dev server)
```

- `webServer` in the config runs `npm run dev` and **reuses an already-running dev
  server** locally, so it works whether or not the app is up. Runs against the dev
  database's seeded catalog.
- **Scope today**: public storefront journeys (browse -> catalog -> product detail)
  - no auth, no payment, so they stay fast and stable. Selectors are role/URL
  based, resilient to copy changes.
- **Follow-up** (wired with CI): the authenticated checkout journey (sign up ->
  create product -> checkout -> review -> return) needs Clerk **test users** and
  Stripe **test mode**; keep those flows in their own spec with a stored auth state.
- Excluded from the unit run (`e2e/**`); has its own runner and report
  (`playwright-report/`, gitignored).
