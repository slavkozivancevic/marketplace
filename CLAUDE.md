# MarketVerse - agent instructions

Multi-tenant marketplace. Next.js 16 (App Router, `cacheComponents`), React 19,
TypeScript, Prisma 7 + Postgres (Neon), Clerk auth, Stripe Connect, next-intl,
Tailwind 4 + shadcn/ui, deployed to AWS via SST + OpenNext.

---

## Verification loop

Run these before reporting any task complete. All must be green.

```
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm test              # vitest run
```

Additional, only when relevant to the change:

```
npm run check:locales      # after adding or changing any UI copy
npm run typecheck:infra    # after editing sst.config.ts
npm run test:integration   # after touching db/ layer (needs a database)
npm run test:e2e           # playwright, slow - only on request
npm run db:check-drift     # after any migration work
```

Never run `npm run build` casually - it is slow. Prefer `typecheck`.

---

## Hard rules

- **Never run `git commit` or `git push`.** Report what changed and let the user
  commit. When the user does commit, branch commits are `wip`; the PR title
  carries the real message (squash-merge).
- **After editing `prisma/schema.prisma`, STOP.** Do not run `prisma migrate`.
  Report the schema change and wait for the user to run the migration.
- **Never deploy.** No `sst deploy` from this machine (Windows). Deploys go
  through CodePipeline on push.
- **Never use an em dash** in code, comments, translations, docs or chat output.
  Use `-` instead.
- Do not touch internal identifiers (SSM parameter names, SST resource names,
  repo names). The product was rebranded to MarketVerse; the infrastructure
  names were deliberately left alone.

---

## Repo map

```
src/app/(i18n)/[locale]/   localized routes: (public) (dashboard) (auth) admin
src/app/(fallback)/        not-found and other non-localized shells
src/app/api/               route handlers
src/features/<domain>/     actions/ components/ db/ schema/  <- the main unit
src/core/db/               prisma client, tenant client, transient errors
src/lib/                   auth, cache, currency, i18n, observability, seo
messages/{en,sr,de,es}.json  all UI copy
prisma/schema.prisma       single schema file
sst.config.ts              all infrastructure
infra/grafana/             dashboard JSON
```

A feature folder is the default place for new code. Only put something in
`src/lib/` if two or more features genuinely share it.

---

## Non-obvious invariants

These have each caused a real bug. Violating them compiles fine and fails in
production.

**Money.** Every stored price is an `Int` in USD base cents (`Product.price`,
`ProductVariant.price`, `Organization.shippingFlatRate`, `Coupon.value`).
Currency (`usd`/`eur`/`rsd`) is display-only, resolved from the `NEXT_CURRENCY`
cookie and converted via `convertCents()` + `CurrencyRate`. There is no
localStorage persistence of currency - it is seeded from the server in
`CurrencyRatesProvider`.

**Cart value.** `resolveCart()` in `src/features/cart/db/resolveCart.ts` is the
single source of truth for what a cart is worth. Coupon minimums, per-seller
shipping thresholds, the order summary and checkout all build on it. Never
compute cart value anywhere else. Never silently zero a stale line - it goes to
`unavailable`.

**Cache.** Reads use `use cache` + `cacheTag` (tags in `src/lib/cache/tags.ts`) +
`cacheLife("max")`. Because `max` never expires on its own, every revalidation
must call **both** `revalidateTag` and `updateTag`. Calling only `revalidateTag`
serves stale data until a hard reload.

**React Query keys.** Any org-scoped query key must include `orgId` (from
`useActiveOrgId`), on the client *and* in the SSR prefetch. The two keys must
match exactly or the prefetch is wasted. Missing `orgId` causes cross-tenant
cache bleed when the user switches org. `resolveRequestContext` is
DB-authoritative for `activeOrgId`.

**Localization.** Four locales, always. Slugs are per-locale
(`ProductTranslation.slug` etc.) with `SlugHistory` for redirects. Pages with a
dynamic slug must publish a per-locale URL map to `LocalePathsHost` so the
language switcher can translate the current URL. `next-intl`'s router drops
query params when used with a pathnames map.

**Soft 404.** `cacheComponents` makes `notFound()` return HTTP 200 - the
prerendered shell flushes the status line before the page runs, so no page can
fix its own status. Real 404s come from `proxy.ts` only, in three layers:
`isUnknownLocalePath` (route table, derived from `routing.pathnames`),
`isUnservableStorefrontPath` (URL shape), then a slug/id existence lookup. Any
new route MUST be registered in `routing.pathnames` or the proxy 404s it -
`appRoutes.test.ts` walks the app directory and fails CI if you forget. On a
not-found page, `<Link>` soft-navigation does not work - use `HardNavBoundary`.

**Verification gate.** An unverified org cannot create or edit products.
Enforced in `requirePermission`, gated in the UI with
`VerificationRequiredNotice`. Platform admins bypass it entirely.

**Permission visibility.** Pick one of three, deliberately: hide the whole
feature, show it locked with an explanation, or show a read-only banner.
`canManageOrgPayouts` is the single source for payout permissions.

**Neon cold start.** The database sleeps. The first query after idle is slow
because the instance is waking, not because the query is slow. See
`src/lib/observability/idleGap.ts` - never conflate the two in metrics.

---

## Conventions

**Forms.** All admin forms: `mode: "onChange"`, Save disabled while there are
errors, `noValidate`, custom inputs render their error inline. Reference
implementation: `src/features/coupons/components/CouponForm.tsx`.

**Required fields.** Asterisk on required labels only, nothing on optional ones,
plus a `RequiredFieldsNote` legend.

**Form reset on navigation.** Reset on `useNavigationGeneration`, never on
`usePathname` - the pathname is identical when returning to the same route and
the warm Router Cache keeps stale edits. Reference: `products/new`.

**Field arrays.** Controls inside `.map()` that read
`form.watch(\`arr.${i}.f\`)` do not re-render on `setValue`. Use a top-level
`useWatch`.

**Tables.** Numeric cells right-aligned with `tabular-nums`. Status centered.
Action icon rows right-aligned with `pr-2.5`. The header must live inside the
overflow container.

**"Add X" button.** Page header action is always
`<Button asChild><Link>{t("addX")}</Link></Button>` - no size prop, no icon,
label reads "Add X" not "New X".

**Loading states.** Every data-heavy route gets a `loading.tsx` skeleton. CTAs
use `PendingLinkButton`. Action buttons swap both the icon (spinner) and the
label (gerund) while pending, driven by a `pending {id, kind}` state, not a bare
`isPending`.

**Layout.** The shell never scrolls horizontally: `overflow-clip` on shell and
main, and `min-w-0` alongside it (clip is not a scroll container, so it does not
get automatic min-size 0). Page blur belongs to dialog/sheet overlays only,
never to `data-scroll-locked`.

**Select.** `position="popper"` is the shared default. Do not re-fix width and
overlap per call site.

---

## Working style

- For anything touching more than about three files, enter plan mode first and
  get the plan approved before writing code.
- Feature specs are kept outside this repo. When I point you at one, read it
  fully and treat its OPEN QUESTIONS block as questions to ask, not gaps to fill
  in on your own.
- When asking the user to test something with new data (a tag, a product), give
  concrete example values for every field, including all four translations.
- Ask one question at a time and wait for the answer.
- Migration drift reporting "modified after applied" is almost always a
  duplicate rolled-back row in `_prisma_migrations`. Delete the duplicate row.
  Never run `migrate resolve --rolled-back` on an applied migration.
