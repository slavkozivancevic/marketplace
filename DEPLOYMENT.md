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
  drive changelog + semver.
- **release-please** (`.github/workflows/release-please.yml`) maintains a rolling
  Release PR; merging it bumps the version, writes `CHANGELOG.md`, tags
  `vX.Y.Z`, and cuts a GitHub Release.
- The **tag/Release is the production trigger**. Staging deploys continuously
  from `main`; production is an explicit, approved release.

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
- [ ] **AWS OIDC provider + scoped deploy IAM roles** (phase #31).
- [ ] **SST/OpenNext** for the `marketplace` app (phase #31).
- [ ] **CodePipeline + CodeBuild + CodeDeploy** (canary + alarm rollback) per
      service (phase #31).
- [ ] **PR preview** ephemeral stages + teardown (phase #31).
- [ ] **CloudWatch alarms** feeding deploy rollback (with #23B sinks, phase #31).
