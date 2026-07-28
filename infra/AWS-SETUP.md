# AWS setup runbook (ROADMAP #31)

Step-by-step to take the platform live on AWS. **Order matters** - the sibling
services must deploy *before* the app (they publish SSM params the app reads),
and the CI/CD pipeline comes last. Everything lives in **`eu-central-1`**.

Do the whole thing for **`staging`** first, verify, then repeat for
**`production`**. Anywhere you see `staging`, swap it for `production` on the
second pass.

Legend: 🖥️ = AWS Console click, ⌨️ = terminal command.

---

## Phase 0 - Accounts & tools (one-time)

- [ ] **0.1** Create an AWS account (if you don't have one).
- [ ] **0.2** 🖥️ Secure the root user (MFA), then create an admin identity you'll
      actually use: IAM Identity Center user **or** an IAM user with the
      `AdministratorAccess` policy. Create an **access key** for it.
- [ ] **0.3** Install **AWS CLI v2**, then ⌨️ `aws configure` - paste the access
      key/secret, set default region **`eu-central-1`**, output `json`. Verify:
      ⌨️ `aws sts get-caller-identity` (should print your account id).
- [ ] **0.4** Install **Node 22**. In each repo (`marketplace` and the three
      `marketplace-*` siblings): ⌨️ `npm ci`.
- [ ] **0.5** Rule of thumb: **region = `eu-central-1` everywhere**. Mixing
      regions breaks the SSM/SNS wiring.

---

## Phase 1 - Database

- [ ] **1.1** Pick one:
  - **Neon** (recommended, `$0` to start, instant branches for PR previews), or
  - **AWS RDS Postgres** (free tier ~12 months; turn on **storage encryption at
    rest** to satisfy ROADMAP #22).
- [ ] **1.2 (Neon)** 🖥️ Create a project in an EU region, copy the **pooled**
      connection string (ends with `?sslmode=require`). Keep it - it becomes the
      app's `DatabaseUrl` secret.
- [ ] **1.3 (RDS alt)** 🖥️ Create a Postgres instance, encryption on, note the
      connection URL + open the security group to your deploy path.

> Note: the app's Prisma needs the `pg_trgm` extension. On Neon/RDS it's created
> by the first `prisma migrate deploy` (the migration enables it).

---

## Phase 2 - Deploy the sibling services (DO THIS FIRST)

Each sibling deploy creates the SSM params the app discovers
(`HTTP_API_URL`, `SEARCH_API_URL`, `SNS_TOPIC_ARN`, ...). Their **secrets** must
exist before/at deploy. Do all three.

### 2.1 `marketplace-messaging`
It has **no setup script**, so create its two secret params by hand:

```sh
# JWT signing secret for chat tokens
aws ssm put-parameter --region eu-central-1 --type SecureString \
  --name "/marketplace-messaging/staging/CHAT_SECRET" \
  --value "$(openssl rand -hex 32)"

# Internal API key - MUST equal the app's CHAT_INTERNAL_API_KEY (Phase 3)
aws ssm put-parameter --region eu-central-1 --type SecureString \
  --name "/marketplace-messaging/staging/INTERNAL_API_KEY" \
  --value "<pick-a-strong-key-and-remember-it>"
```

Then ⌨️ `cd ../marketplace-messaging && npx sst deploy --stage staging`.

### 2.2 `marketplace-notifications`
Uses SES to send email.

- [ ] 🖥️ In **SES**: verify a sender domain or email; request **production
      access** (new accounts are sandboxed and can only email verified addresses).
- [ ] ⌨️ `cd ../marketplace-notifications && npm run setup` - seeds its params
      (`SES_FROM_EMAIL`, `MARKETPLACE_API_KEY`, `APP_URL`). `MARKETPLACE_API_KEY`
      here MUST equal the app's `NOTIFICATIONS_API_KEY` (Phase 3).
- [ ] ⌨️ `npx sst deploy --stage staging`.

### 2.3 `marketplace-conversation-search`
- [ ] ⌨️ `cd ../marketplace-conversation-search && npm run setup` - seeds
      `INTERNAL_API_KEY` (MUST equal the app's `CONVERSATION_SEARCH_API_KEY`) and
      `MARKETPLACE_API_KEY` (the key it uses to call the app back).
- [ ] ⌨️ `npx sst deploy --stage staging`.

> `MARKETPLACE_API_URL` in the notifications/search namespaces is written
> automatically by the **app** deploy (Phase 3), so you can leave it for now.

---

## Phase 3 - Deploy the app (staging)

- [ ] **3.1** ⌨️ `cd ../marketplace`.
- [ ] **3.2** Set all 9 secrets (SST stores them encrypted in SSM):

```sh
npx sst secret set DatabaseUrl              "<neon/rds url>"        --stage staging
npx sst secret set ClerkSecretKey           "<clerk secret>"       --stage staging
npx sst secret set ClerkWebhookSecret       "<clerk wh secret>"    --stage staging
npx sst secret set StripeSecretKey          "<stripe secret>"      --stage staging
npx sst secret set StripeWebhookSecret      "<stripe wh secret>"   --stage staging
npx sst secret set ChatInternalApiKey       "<= messaging INTERNAL_API_KEY>"          --stage staging
npx sst secret set ConversationSearchApiKey "<= conversation-search INTERNAL_API_KEY>" --stage staging
npx sst secret set NotificationsApiKey      "<= the key siblings send as MARKETPLACE_API_KEY>" --stage staging
npx sst secret set AnthropicApiKey          "<claude key, or empty>" --stage staging
```

- [ ] **3.3** ⌨️ `npx sst deploy --stage staging`. This builds (OpenNext),
      provisions the media bucket + site, and writes the app URL back into the
      notifications/search namespaces.
- [ ] **3.4** Run migrations against the staging DB:
      ⌨️ `npm run db:migrate:stage -- --stage staging`.
      (NOT `npx sst shell --stage staging -- npx prisma migrate deploy` - that
      silently migrates your LOCAL database instead. `sst shell` only exposes
      linked secrets via `SST_RESOURCES_JSON`, not as raw `process.env.DATABASE_URL`
      - this app reads secrets as plain env vars, so `DATABASE_URL` falls
      through to whatever your local `.env` sets, with no error. Verified
      2026-07-28 - see `scripts/migrate-stage.mjs` for the fix and root cause.)
- [ ] **3.5** Grab the site URL from the deploy output and open it.

### Shared-key pairing (keep these identical)

| App secret | Sibling param |
|---|---|
| `ChatInternalApiKey` | messaging `/…/INTERNAL_API_KEY` |
| `ConversationSearchApiKey` | conversation-search `/…/INTERNAL_API_KEY` |
| `NotificationsApiKey` | notifications + search `/…/MARKETPLACE_API_KEY` |

---

## Phase 4 - External integrations (Clerk / Stripe / SES)

- [ ] **4.1 Clerk** 🖥️ Point your Clerk instance at the deployed URL (allowed
      origins), create the **webhook** endpoint `<appurl>/api/webhooks/clerk`, and
      copy its signing secret into `ClerkWebhookSecret` (re-run the secret set +
      redeploy if it changed).
- [ ] **4.2 Stripe** 🖥️ Create the **webhook** endpoint
      `<appurl>/api/webhooks/stripe`, copy the signing secret into
      `StripeWebhookSecret`. Configure Connect (payouts) for the real flow.
- [ ] **4.3 SES** (done in 2.2) - make sure you're out of the sandbox for real
      recipients.

---

## Phase 5 - CI/CD pipeline

- [ ] **5.1** 🖥️ Create a **CodeConnections** GitHub connection: Console ->
      Developer Tools -> Settings -> **Connections** -> Create connection ->
      GitHub -> **authorize** the AWS Connector app -> copy the ARN
      (`arn:aws:codeconnections:...`).
- [ ] **5.2** Deploy the CI/CD stack:

```sh
aws cloudformation deploy \
  --template-file infra/cicd.cfn.yml \
  --stack-name marketplace-cicd \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    GitHubOrg=slavkozivancevic GitHubRepo=marketplace \
    CodeConnectionArn=<arn-from-5.1>
# add CreateOidcProvider=false if the GitHub OIDC provider already exists
```

- [ ] **5.3** Read the stack output:
      ⌨️ `aws cloudformation describe-stacks --stack-name marketplace-cicd \
      --query "Stacks[0].Outputs"`.
      Take **`PreviewDeployRoleArn`** and 🖥️ set it as the GitHub **repo
      variable** `AWS_PREVIEW_ROLE_ARN` (repo -> Settings -> Secrets and variables
      -> Actions -> **Variables** -> New variable).
- [ ] **5.4** Test the loop:
  - Open a PR -> `preview.yml` deploys a `pr-<n>` stage and comments the URL.
  - Push/merge to `main` -> CodePipeline runs `DeployStaging`, waits at
    `ApproveProduction`.

---

## Phase 6 - Production

- [ ] **6.1** Repeat Phase 2 + 3 secrets with `--stage production` (siblings'
      `npm run setup:prod` / manual params, and `sst secret set ... --stage
      production`).
- [ ] **6.2** Deploy siblings + app for production (or let the pipeline's
      `DeployProduction` do the app after you approve).
- [ ] **6.3 Domain** 🖥️ Register/route a domain (Route 53), then in
      `sst.config.ts` uncomment the `domain:` line per stage and set `APP_URL`;
      redeploy. This flows into canonical/hreflang/OG/sitemap automatically.

---

## Phase 7 - What still needs doing after (follow-ups)

These are known and tracked; do them once the above is live:

1. **App AWS credential chain** (`TODO(aws)` in `sst.config.ts`): make the
   S3/SNS/SSM clients use the default provider chain on Lambda (role temp creds
   carry a session token) instead of explicit static keys.
2. **CloudFront for media** (ROADMAP #24): put a CDN in front of the S3 bucket
   and switch `S3_PUBLIC_URL` to the CDN domain.
3. **Canary + rollback** (DEPLOYMENT.md §5): decide CloudFront+SST-redeploy vs
   CodeDeploy-on-the-server-alias, then wire **CloudWatch alarms** (ROADMAP #23B).
4. **CORS lockdown** (ROADMAP #21): replace `allowOrigins:["*"]` on the messaging
   API + S3 with the real domain.
5. **Split prod pipeline to tag-trigger** (DEPLOYMENT.md §6 TODO): make a
   `vX.Y.Z` tag/Release the production trigger instead of a `main` push.
6. **Observability sinks** (ROADMAP #23B): CloudWatch Logs/Dashboards (or Grafana
   Cloud), Sentry (env-gated), uptime monitor on `/api/health`.
7. **Real-time search indexing**: re-enable once the app has a stable URL (was
   blocked on the ngrok URL).
