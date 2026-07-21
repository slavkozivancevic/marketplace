# CI/CD & Deployment strategy

The single source of truth for how the marketplace platform is built, released,
and deployed. Decisions here are locked; open items are called out per phase.

---

## 1. The platform (services)

Polyrepo - each service is its own GitHub repo and its own deployable unit.

| Repo | Runtime | Deploy (IaC) | State |
|---|---|---|---|
| `marketplace` | Next.js 16 (this repo) | SST + OpenNext -> Lambda@CloudFront | app |
| `marketplace-notifications` | Lambda (SES/SNS/SQS) | SST | live |
| `marketplace-messaging` | Lambda service | SST | live |
| `marketplace-conversation-search` | Lambda + DynamoDB | SST | live |
| `marketplace-showcase` | static portfolio | GitHub Pages | live |

Services stay decoupled at runtime and discover each other through **SSM
Parameter Store** (e.g. notifications publishes its SNS topic ARN to SSM;
marketplace reads it). No hardcoded cross-service endpoints.

### Repo strategy - polyrepo + reusable workflows

Kept as separate repos (independent release cadence, no migration cost). Shared
consistency comes from a **reusable GitHub Actions workflow** referenced by every
repo, rather than a monorepo. A future Turborepo monorepo is possible but not
required and is out of scope now.

---

## 2. Tooling split: GitHub Actions (CI) + AWS-native (CD)

- **CI = GitHub Actions.** Fast quality gate on every PR/push. No cloud
  credentials needed. (Done - `.github/workflows/ci.yml`.)
- **CD = AWS CodePipeline -> CodeBuild -> CodeDeploy.** The deploy path lives in
  AWS: CodeBuild runs the build + `sst deploy`; CodeDeploy shifts Lambda traffic
  with canary + automatic rollback. (Provisioned in phase #31.)
- **IaC = SST** under the hood for every service (already the standard for the
  Lambda services); CodeBuild simply runs `sst deploy --stage <stage>`.

Why this split: GitHub Actions gives the best PR DX for gating; AWS-native CD is
the deliberate learning goal and keeps deploy mechanics (traffic shifting,
alarms, rollback) where the infrastructure lives. It also stays within free
tiers (see Cost).

> Not chosen: pure GitHub-Actions deploy (would skip the AWS pipeline learning);
> pure AWS-native CI (worse PR DX, redundant with SST).

---

## 3. Environments

SST **stages** are the environment boundary - one AWS footprint per stage.

| Stage | When | Trigger | Data |
|---|---|---|---|
| `dev` | local development | `sst dev` | personal / seed |
| `pr-<n>` | per open PR (**preview**) | PR opened/updated | ephemeral, seeded |
| `staging` | integration/pre-prod | merge to `main` | staging DB |
| `production` | live | GitHub Release tag + **manual approval** | prod DB |

- **PR preview**: an ephemeral stage deployed per PR and **torn down on close**
  (`sst remove`), so reviewers get a real URL. CI status + preview URL post back
  to the PR.
- **Promotion is by commit SHA**, not rebuild: the same commit that passed
  staging is what deploys to production (build-once semantics via the pinned
  source revision).

---

## 4. Pipeline flow (end to end)

```
 PR opened ─▶ GitHub Actions CI (lint, typecheck, unit, integration w/ Postgres)
           └▶ CodePipeline: deploy ephemeral pr-<n> stage ─▶ smoke/e2e on preview
                                                            └▶ comment URL on PR

 merge to main ─▶ release-please updates the Release PR (changelog)
               └▶ CodePipeline (staging): CodeBuild `sst deploy --stage staging`
                                        └▶ e2e/smoke against staging

 merge Release PR ─▶ tag vX.Y.Z + GitHub Release
                  └▶ CodePipeline (production): manual approval gate
                                              └▶ CodeBuild `sst deploy --stage production`
                                              └▶ CodeDeploy canary shift + alarm rollback
```

CI (GitHub) is the merge gate. CD (AWS) owns everything from source-on-branch to
live traffic.

---

## 5. Deploy safety - the serverless "blue/green"

Classic blue/green (two parallel fleets) is an EC2/ECS pattern. On Lambda the
equivalent - and what we use - is **alias-based traffic shifting**:

- Every deploy publishes an **immutable Lambda version**; a stable **alias**
  (e.g. `live`) points at it.
- **CodeDeploy** shifts traffic to the new version **canary** (e.g. 10% for
  N minutes, then 100%) or linearly.
- **CloudWatch alarms** (error rate, p95 latency, 5xx - wired via the #23
  observability logs/metrics) are attached to the deployment. A breach triggers
  **automatic rollback** to the previous version. Rollback is instant (repoint
  the alias) with no cold redeploy.
- CloudFront in front of the app gives the same instant-rollback property for the
  web tier.

Result: bad deploys self-heal, and manual rollback is one alias flip.

---

## 6. Release management

- **Trunk-based**: short-lived branches -> PR -> squash-merge to `main`.
- **Conventional Commits** (`feat:`, `fix:`, `perf:`, `refactor:`, `chore:`...)
  drive changelog + semver. release-please reads the **commit message on
  `main`**, not the PR title directly - since we squash-merge with the default
  squash message set to the PR title, the PR title is what ends up as that
  commit message. This requires two repo settings (Settings -> General ->
  Pull Requests): only "Allow squash merging" enabled (merge commit / rebase
  merging off, so nothing bypasses the squash step), and default squash commit
  message = "Pull request title".
- **`ci.yml`'s `title-lint` job** enforces Conventional Commits on the PR title
  (runs only on `pull_request`) so a malformed title can't reach `main` as the
  squash message. It's not a required status check (solo repo, no branch
  protection) - it just shows red/green on the PR; merging past a red check is
  still possible.
- **Which types bump the version**: `feat` -> minor, `fix`/`perf` -> patch,
  any type with `!` (e.g. `feat!:`) or a `BREAKING CHANGE:` footer -> major.
  **Non-releasing types** - `build`, `ci`, `chore`, `docs`, `test`, `style`,
  `refactor` - never bump the version or touch the Release PR; they merge,
  deploy to staging like any other merge (section 4), and simply don't appear
  in the changelog (several are also marked `hidden` in
  `release-please-config.json`).
- **release-please** (`.github/workflows/release-please.yml`) maintains a
  rolling Release PR from these commits; merging that PR (a manual, explicit
  action) bumps the version, writes `CHANGELOG.md`, tags `vX.Y.Z`, and cuts a
  GitHub Release. It never merges itself.
- The **tag/Release is the production trigger**. Staging deploys continuously
  from `main` on every merge, regardless of commit type; production is an
  explicit, approved release.

> **TODO (pipeline refinement, do on AWS).** The current `infra/cicd.cfn.yml` is
> a **single** pipeline `main -> staging -> manual approval -> production`, so a
> `main` push (after approval) is what reaches prod. The target model above is
> **tag-triggered prod**: split production into its own pipeline whose source is
> the `vX.Y.Z` tag / GitHub Release (staging stays continuous from `main`).
> Deliberately kept as one simpler pipeline for now; wire the split when the
> pipeline is live on AWS.

---

## 7. Secrets, identity & config

- **No long-lived AWS keys.** CodeBuild assumes an IAM role; GitHub->AWS actions
  (preview/teardown) use **GitHub OIDC** federation to a scoped IAM role. (SST's
  own state/deploy perms are scoped per stage.)
- **App config/secrets** live in **SSM Parameter Store** (SecureString) per
  stage - the pattern the Lambda services already use. Nothing secret in the
  repo; `.env*` is gitignored, `.env.test.example` documents shape only.
- **Least privilege**: each stage's deploy role is limited to that stage's
  resources.

---

## 8. Multi-service rollout

1. Author one **reusable CI workflow** (in this repo or a shared `.github` repo);
   each service repo references it with its own matrix (Node version, whether it
   needs a Postgres service, etc.).
2. Each service repo gets its own CodePipeline (source = its GitHub branch).
3. Deploy order is not orchestrated centrally - SSM discovery makes services
   tolerant of each other's deploy timing (a consumer reads the latest published
   ARN/URL). A platform-wide "release" is coordinated tags across repos.

---

## 9. Cost posture ($0 until traffic)

- **GitHub Actions**: free minutes on public/most private repos.
- **CodePipeline**: 1 free active pipeline/month; keep the pipeline count lean
  (staging+prod as stages of one pipeline where possible).
- **CodeBuild**: free-tier build minutes (`general1.small`).
- **CodeDeploy for Lambda**: free.
- **SST/Lambda/CloudFront/RDS**: pay-per-use / free-tier; standing cost stays ~$0
  until real traffic. RDS storage **encryption at rest** is a free checkbox (see
  ROADMAP #22).

---

## 10. Status

- [x] **CI (GitHub Actions)** - `ci.yml`: lint, typecheck, unit, integration
      (ephemeral Postgres service). Runs on PR + `main`.
- [x] **Release automation** - `release-please` (Conventional Commits -> Release
      PR -> tag -> GitHub Release).
- [x] **Reusable CI workflow** (`reusable-ci.yml`) + rolled out: `marketplace`
      (quality via reusable + own integration job), `marketplace-notifications`,
      `marketplace-messaging`, `marketplace-conversation-search` each call it. Every
      service now has Vitest + unit **and** handler tests (notifications 14,
      messaging 8, conversation-search 9) + `typecheck`/`test` scripts. Handler
      tests mock the AWS SDK via `aws-sdk-client-mock` (no network/containers);
      real AWS wiring is validated by stage smoke tests in phase #31.
      `marketplace-showcase` is a static site (no build/package.json): it gets its
      own minimal `ci.yml` - a dependency-free asset check (`scripts/check-assets.sh`,
      every local `src`/`href` in `index.html` must resolve) + a non-blocking
      external-link check (lychee). No release-please/versioning (no consumer,
      no semver value); deploy stays on GitHub Pages.
      NOTE: the cross-repo `uses:` resolves once this repo's reusable workflow is
      pushed to `main` on GitHub.
- [~] **SST/OpenNext for the `marketplace` app** - `sst.config.ts` authored
      (Nextjs/OpenNext site, media bucket, secrets, cross-service SSM discovery,
      stages, region `eu-central-1`) + `buildspec.yml` for CodeBuild. Type-checked
      against generated SST platform types. Siblings publish their consumer URLs to
      SSM (`HTTP_API_URL`, `SEARCH_API_URL`) so the app discovers them; the app
      publishes its own URL back into the notifications/search namespaces. Not yet
      deployed - see Bootstrap (section 11) for the manual AWS steps.
- [~] **AWS OIDC provider + scoped deploy IAM roles** - authored in
      `infra/cicd.cfn.yml` (OIDC provider + repo-scoped preview-deploy role). Not
      deployed; see Bootstrap step 9.
- [~] **CodePipeline + CodeBuild** - authored in `infra/cicd.cfn.yml` (CodeBuild
      runs `buildspec.yml`; pipeline Source -> staging -> manual approval ->
      production). **CodeDeploy canary** left as a deploy-time decision (sst deploy
      already shifts traffic) - see `infra/README.md`.
- [~] **PR preview** ephemeral stages + teardown - `preview.yml` /
      `preview-teardown.yml` (OIDC assume-role -> `sst deploy` / `sst remove`).
- [ ] **CloudWatch alarms** feeding deploy rollback (with #23B sinks, phase #31).

---

## 11. Bootstrap - manual AWS steps (one-time)

The `sst.config.ts` + `buildspec.yml` are authored but nothing is deployed. These
are the manual steps to light up a stage (do `staging` first, then `production`).
All resources live in **`eu-central-1`**.

> **Full click-by-click runbook: [`infra/AWS-SETUP.md`](infra/AWS-SETUP.md).**
> The list below is the summary; the runbook has the exact commands, the
> service-by-service order, and the shared-key pairings.

1. **AWS account + local creds.** An admin AWS profile for the first `sst deploy`
   (the pipeline later uses an assumed role instead).
2. **Decide the database** (drives `DatabaseUrl`):
   - external managed Postgres (e.g. Neon free tier) - `$0`, fastest, OR
   - AWS RDS Postgres (free tier first year) / Aurora Serverless v2 - enables the
     "RDS encryption at rest" checkbox (ROADMAP #22). Turn on storage encryption.
3. **Deploy the sibling services first** (they publish the SSM params the app
   reads). In each of `marketplace-messaging`, `marketplace-notifications`,
   `marketplace-conversation-search`: set their secrets (`sst secret set ...` -
   e.g. `INTERNAL_API_KEY`) and `sst deploy --stage staging`. This creates
   `/marketplace-*/staging/{HTTP_API_URL,SEARCH_API_URL,SNS_TOPIC_ARN,...}`.
4. **Set the app secrets** (per stage), for every `sst.Secret` in `sst.config.ts`:
   `DatabaseUrl, ClerkSecretKey, ClerkWebhookSecret, StripeSecretKey,
   StripeWebhookSecret, ChatInternalApiKey, ConversationSearchApiKey,
   NotificationsApiKey, AnthropicApiKey` -
   `npx sst secret set DatabaseUrl "<url>" --stage staging` (repeat per secret).
   The `*ApiKey` values must match the ones the siblings expect.
5. **First app deploy:** `npx sst deploy --stage staging`. This provisions the
   media bucket + Nextjs site and writes the app URL back into the
   notifications/search namespaces (callback loop).
6. **Run migrations** against the stage DB (see `buildspec.yml` - verify the
   `sst shell -- prisma migrate deploy` step resolves `DATABASE_URL`).
7. **Fix the AWS credential chain in the app** (`TODO(aws)` in `sst.config.ts`):
   the S3/SNS/SSM clients must use the default provider chain on Lambda (role temp
   creds carry a session token) rather than explicit static keys.
8. **Domain** (when ready, ROADMAP #31): map the domain in `sst.config.ts`
   (`domain:` per stage) and set `APP_URL`; this flows into canonical/hreflang/OG.
9. **CI/CD pipeline** - authored in [`infra/cicd.cfn.yml`](infra/cicd.cfn.yml)
   (see [`infra/README.md`](infra/README.md)). Create a GitHub CodeConnections
   connection, deploy the stack (`aws cloudformation deploy ... marketplace-cicd`),
   then set the `PreviewDeployRoleArn` output as the `AWS_PREVIEW_ROLE_ARN` repo
   variable so `preview.yml` can assume it. CodeDeploy canary + CloudWatch-alarm
   rollback is a deploy-time decision (see `infra/README.md`).

---

## 12. Production activation checklist (test/dev -> live)

Things that run in test/mock/sandbox mode and must be flipped for real production
traffic. Staging deliberately stays in test mode; this is what changes for prod.

| Item | Current (staging) | Action to go live |
|---|---|---|
| **Stripe Connect mock** | On the deployed Lambda `NODE_ENV=production`, so `MOCK_CONNECT` defaults to **false**. We force it on via `MOCK_STRIPE_CONNECT="true"` so seller onboarding/payouts are simulated (no real transfers). | Set `MOCK_STRIPE_CONNECT="false"` once Stripe Connect is live (needs an EU IBAN + activated account). Until then keep it `"true"` on **every** stage. |
| **Stripe keys** | Test keys. Card checkout runs in Stripe test mode. | Set live `StripeSecretKey` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` per stage. **COD works without Stripe**, so a COD-only launch is possible meanwhile. |
| **Stripe webhook** | Points at the staging URL (test mode signing secret). | Create a live-mode webhook at `<prod-url>/api/webhooks/stripe`, set `StripeWebhookSecret`. |
| **Clerk** | Dev instance (`pk_test_`). | Create a Clerk **production instance** (requires a domain + DNS records), set live keys + `ClerkWebhookSecret` for the prod webhook `<prod-url>/api/webhooks/clerk`. |
| **SES** | AWS account in the **sandbox** - can only email verified addresses. | Request **SES production access** so real customers receive email. |
| **AI review moderation** | `ANTHROPIC_API_KEY` unset -> reviews stay PENDING (manual moderation). | Optional: set `AnthropicApiKey` to enable auto-moderation. |
| **CORS** | `allowOrigins: ["*"]` on the messaging API + S3 bucket. | Lock to the real domain (ROADMAP #21) once the domain exists. |
| **Domain / APP_URL** | Auto CloudFront URL per stage. | Register a domain; map `domain:` in `sst.config.ts` (prod = apex, staging = subdomain); `APP_URL` follows -> canonical/hreflang/OG/sitemap. |
| **Product search** | Postgres `searchText` (in-DB, no external index). | Nothing - works out of the box, no ngrok dependency. |
