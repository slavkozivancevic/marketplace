# Marketplace Platform

A production-grade, multi-tenant e-commerce platform built as a monorepo of four tightly-integrated services. The core storefront is a full-stack Next.js application; real-time chat, conversation search, and transactional notifications are deployed as independent serverless microservices on AWS, communicating over an event-driven backbone (SNS → SQS → Lambda).

---

## Services at a Glance

| Service | Description | Stack |
|---|---|---|
| **marketplace** | Full-stack storefront & seller dashboard | Next.js 16, React 19, PostgreSQL, Redis |
| **marketplace-messaging** | Real-time chat with WebSocket, reactions & file attachments | AWS Lambda, API Gateway WebSocket, DynamoDB |
| **marketplace-conversation-search** | Conversation search index, event-driven via SNS/SQS | AWS Lambda, DynamoDB, SNS, SQS |
| **marketplace-notifications** | Transactional email service (orders, invites, role changes) + weekly currency-rate cron | AWS Lambda, SES, DynamoDB, SNS/SQS, EventBridge |

---

## marketplace - Core Platform

Multi-tenant e-commerce storefront. Organizations (sellers) manage products with variants, images, categories, brands, tags, and stock; customers browse, search, wishlist, review, and check out via Stripe or Cash-on-Delivery (COD). Includes a full admin panel, seller dashboard, related-products carousel, multi-currency pricing (EUR/RSD with daily-refreshed FX rates), and full i18n across **English, Serbian, German, and Spanish**.

### Tech Stack

- **Framework:** Next.js 16 (App Router) with **React 19** and the experimental **React Compiler** (automatic memoization - no manual `useMemo`/`useCallback`)
- **Language:** TypeScript 5 (strict)
- **Database:** PostgreSQL 17 via **Prisma 7** with the native `@prisma/adapter-pg` driver adapter
- **Auth:** **Clerk** (`@clerk/nextjs` v6) with Svix-verified webhooks for real-time user sync
- **Payments:** Stripe Checkout + webhook-driven order fulfillment, plus **Cash-on-Delivery (COD)** with seller-driven fulfillment / cancellation flows
- **i18n:** **next-intl v4** with a cookie-based locale (`NEXT_LOCALE`), four supported locales (`en`, `sr`, `de`, `es`), per-product translation tables, and a search-text blob backfilled across locales for cross-language full-text search
- **Currencies:** Multi-currency display (EUR / RSD) backed by a `CurrencyRate` table refreshed weekly by the notifications service (see below)
- **Storage:** AWS S3 with presigned upload URLs (browser → S3 direct), `sharp` for server-side image processing, and bucket-level **lifecycle rules** that sweep abandoned uploads tagged `lifecycle=pending` after 24h
- **Email:** AWS SES - invoked exclusively by the **marketplace-notifications** service; the marketplace itself publishes events to SNS and never calls SES directly
- **Outbound events:** AWS **SNS** publishes domain events (`order.completed`, `order.refunded`, `order.cod_*`, `invite.sent`, `member.role_changed`, `user.role_changed`) consumed by the notifications service
- **Cache / Queues:** Redis via `ioredis`
- **UI:** **Tailwind CSS 4** (native CSS cascade layers, polished light/dark themes), Radix UI primitives, **shadcn/ui** component library, `lucide-react`, `next-themes`
- **Carousel:** Embla Carousel with autoplay (related products on PDP)
- **Drag & Drop:** `@dnd-kit` (image ordering, variant management)
- **Forms & Validation:** `react-hook-form` + **Zod 4** + `@hookform/resolvers`
- **Server State:** **TanStack Query v5** (with DevTools)
- **Virtualization:** **TanStack Virtual v3** (efficient rendering of long lists)
- **URL State:** `nuqs` (type-safe, SSR-compatible URL search params as state)
- **Client State:** Zustand v5
- **PDF Rendering:** `pdfjs-dist` v5 (in-browser PDF attachment preview)
- **Env Validation:** `@t3-oss/env-nextjs` (type-safe environment variables with Zod, validated at build time)

### Project Structure

```
src/
├── app/                    Next.js App Router
│   ├── (auth)/             Sign-in / sign-up (Clerk)
│   ├── (dashboard)/        Seller dashboard
│   ├── (public)/           Storefront, product pages, checkout
│   ├── admin/              Admin panel (organizations, products, users)
│   ├── api/                Route handlers (uploads, webhooks, admin, clerk)
│   └── invite/             Organization invite acceptance
├── components/             Shared UI components
├── core/                   Low-level primitives (db, cache, validation, utils)
├── features/               Domain modules (cart, orders, organizations, products, users, webhooks, common)
├── modules/                Higher-level feature modules (auth, marketplace, payments, search)
├── lib/                    Integrations (ai, auth, cache, stripe, utils)
├── services/               External service clients (S3, SES, Stripe, Clerk, image processor)
├── env/                    Type-safe env loaders (client.ts, server.ts)
├── providers/              React context providers
├── generated/prisma/       Generated Prisma client (output target)
└── constants/, types/, utils/

prisma/
├── schema.prisma           Data model
└── migrations/
```

### Data Model (High Level)

Defined in [prisma/schema.prisma](prisma/schema.prisma):

- **User** - synced from Clerk (`clerkUserId`), with `UserRole` (`USER` / `ADMIN` / `SELLER`), `activeOrgId`, and a preferred `locale`.
- **Organization / Membership / Invite** - multi-tenant sellers. Members have a `MembershipRole` (`OWNER` / `ADMIN` / `MEMBER`). Invites are token-based with expiry and `InviteStatus`; invitation emails are dispatched by the notifications service.
- **Product** - belongs to an `Organization`, has `ProductStatus` (`DRAFT` / `PUBLISHED` / `ARCHIVED`), optional stock, versioning, soft-delete (`deletedAt`), audit fields (`createdById`, `updatedById`), per-locale translations, and a denormalized **search-text blob** for fast cross-language search.
- **ProductHistory** - snapshot per version for audit.
- **ProductVariant / ProductVariantImage / VariantOption / VariantOptionValue** - flexible variant matrix (e.g. size × color) with per-variant SKU, price, stock, and dedicated variant images.
- **ProductImage** - S3-backed (`url`, `key`) with ordering.
- **Brand / Category / ProductCategory / Tag / ProductTag** - taxonomy. Categories form a tree (parent/child) used by the storefront's category browser and the related-products engine.
- **Wishlist** - per-user saved products.
- **ProductReview** - buyer reviews with ratings.
- **Order / OrderItem** - linked to a Stripe session (`stripeSessionId`) **or** flagged as COD, with `OrderStatus` (`PENDING` / `COMPLETED` / `CANCELLED` / `REFUNDED`) and a denormalized **shipping address** snapshot captured at checkout.
- **CurrencyRate** - single-row-per-currency rate table (relative to USD) upserted weekly by the notifications service's currency-refresh cron.
- **WebhookEvent** - idempotency tracking for external webhooks (Stripe / Clerk).

### Prerequisites

- Node.js 20+
- Docker (for the bundled PostgreSQL) or an existing PostgreSQL 17 instance
- A Redis instance
- Clerk, Stripe, and AWS (S3 + SES) accounts

### Getting Started

#### 1. Install dependencies

```bash
npm install
```

#### 2. Start PostgreSQL

A Postgres 17 container is provided:

```bash
docker compose up -d
```

It exposes Postgres on `localhost:5433` (see [docker-compose.yml](docker-compose.yml)).

#### 3. Environment variables

Create a `.env` file in the project root. Variables are validated at build/runtime by [src/env/server.ts](src/env/server.ts) and [src/env/client.ts](src/env/client.ts).

**Server:**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/postgres"

CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=
S3_PUBLIC_URL=

APP_URL="http://localhost:3000"

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# SNS topic ARN of the marketplace-notifications service.
# Resolved at runtime from SSM in production; can be set directly in dev.
NOTIFICATIONS_SNS_TOPIC_ARN=

# Internal API key used by marketplace-notifications to call
# /api/internal/order-details and /api/internal/currency-rates.
MARKETPLACE_INTERNAL_API_KEY=
```

**Client (`NEXT_PUBLIC_*`):**

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/"
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="/"
NEXT_PUBLIC_S3_PUBLIC_URL=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

#### 4. Run database migrations

```bash
npm run db:migrate
```

#### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Next.js in development mode |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma client (output: `src/generated/prisma`) |
| `npm run db:migrate` | Create and apply a dev migration |
| `npm run db:migrate:up` | Apply pending migrations (`prisma migrate deploy`) |
| `npm run db:push` | Push schema without a migration |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:create-migration <name>` | Create a named migration |
| `npm run db:reset` | Drop and recreate the DB (destructive) |
| `npm run db:seed` | Run `prisma/seed.ts` |

### S3 Bucket Setup

Product images are uploaded directly from the browser to S3 via presigned URLs. Each freshly uploaded object is tagged `lifecycle=pending`; the tag is stripped when the corresponding product is saved. A bucket-level lifecycle rule sweeps any object still tagged after 24h, so abandoned form uploads never become long-term orphans.

Apply the rule once per bucket (idempotent):

```bash
npx tsx scripts/apply-s3-lifecycle-rule.ts
```

### Webhooks

External services hit the following routes - expose them via a tunnel (e.g. `ngrok`, `stripe listen`) during local dev:

- **Clerk → `/api/webhooks/clerk`** - syncs users/sessions (verified with `svix`, secret: `CLERK_WEBHOOK_SECRET`).
- **Stripe → `/api/webhooks/stripe`** - checkout completion, payment, refunds, etc. (secret: `STRIPE_WEBHOOK_SECRET`).

### Routing Overview

- `(public)` - storefront: home, product listing/detail, cart, checkout
- `(auth)` - Clerk sign-in / sign-up
- `(dashboard)` - authenticated seller dashboard
- `admin/` - admin panel for managing organizations, products, and users
- `invite/` - accept organization invites
- `api/uploads` - presigned S3 upload endpoints
- `api/admin`, `api/clerk`, `api/webhooks` - internal and integration endpoints
- `api/internal/order-details` - internal endpoint consumed by marketplace-notifications to render order emails (`x-api-key`-protected)
- `api/internal/currency-rates` - internal endpoint upserted by the notifications weekly cron with fresh USD→{EUR,RSD} rates

---

## marketplace-messaging - Real-Time Chat Service

> Located at `../marketplace-messaging`

A fully serverless real-time messaging system. Users communicate via persistent WebSocket connections managed by API Gateway; a companion HTTP API handles conversation lifecycle, file attachments, and emoji reactions. All state lives in a single DynamoDB table designed for single-table access patterns.

### Architecture

```
Browser
  │
  ├── WebSocket (wss://) ──► API Gateway WebSocket API
  │                               ├── $connect    → authenticate JWT, register connection
  │                               ├── $disconnect → remove connection record (TTL-backed)
  │                               ├── sendMessage → persist to DynamoDB, fan-out to all
  │                               │                 active connections of recipient via
  │                               │                 ApiGatewayManagementApi
  │                               └── markRead    → update unread count, push to recipient
  │
  └── HTTP (https://) ──► API Gateway HTTP API
        ├── POST /auth/token              → issue short-lived JWT (consumed by WebSocket client)
        ├── POST /conversations           → create conversation (publishes to SNS search topic)
        ├── GET  /conversations           → list user's conversations
        ├── GET  /conversations/{id}/messages → paginated message history
        ├── POST /attachments/upload-url  → presigned S3 PUT for direct browser upload
        ├── GET  /attachments/read-url    → presigned S3 GET for secure file access
        ├── GET  /conversations/{id}/reactions  → fetch emoji reactions per message
        ├── POST /conversations/{id}/reactions  → toggle reaction, push update via WebSocket
        └── DELETE /conversations/{id}    → soft-delete, push to recipients, unpublish from search
```

### Tech Stack

- **IaC / Deploy:** **SST v4 (Ion)** - Pulumi-based infrastructure-as-TypeScript with multi-stage support (`dev` / `production`)
- **Runtime:** AWS Lambda (Node.js) - TypeScript 6, fully type-safe handlers
- **Real-time transport:** **AWS API Gateway WebSocket API** - persistent bidirectional connections, server-push via `ApiGatewayManagementApi`
- **HTTP API:** AWS API Gateway HTTP API (v2)
- **Database:** **AWS DynamoDB - single-table design** with two GSIs:
  - `GSI1`: user → all conversations, sorted by last message timestamp
  - `GSI2`: user → all active WebSocket connections (for fan-out delivery)
  - `TTL` attribute for automatic expiry of stale connection records
- **File storage:** AWS S3 with presigned upload (PUT) and read (GET) URLs - zero-byte Lambda traffic for file transfers
- **Secrets:** AWS SSM Parameter Store (SecureString) - secrets fetched at cold start, never baked into Lambda environment
- **Auth:** **JOSE** (JWT) - short-lived tokens issued by the HTTP API and verified by WebSocket and HTTP Lambdas
- **IDs:** ULID (universally unique, lexicographically sortable - ideal as DynamoDB sort keys)
- **Push notifications:** AWS SNS (publishes `conversation.created` / `conversation.deleted` events to the search service)

### Key Engineering Decisions

- **Single-table DynamoDB design** - all entity types (conversations, messages, connection records, reactions) coexist in one table, accessed via carefully crafted PK/SK patterns and GSIs. Eliminates cross-table joins and scales horizontally without relational overhead.
- **TTL-based connection cleanup** - WebSocket `$disconnect` Lambda deletes the connection record immediately; TTL provides a safety net for abrupt disconnects, keeping the connections index clean without a scheduled cleanup job.
- **Fan-out via GSI2** - to deliver a message to a recipient, the Lambda queries `GSI2` to find all of that user's active connections and pushes to each one in parallel via `ApiGatewayManagementApi`. Stale connections are caught and pruned on the fly.
- **SSM runtime secret resolution** - rather than baking secrets into Lambda environment variables (visible in the AWS console), all sensitive values are fetched from SSM Parameter Store on cold start and cached in-memory for the lifetime of the execution environment.
- **Cross-service decoupling via SNS** - the search service's SNS topic ARN is not hardcoded; it is published to SSM on deploy and read at runtime, so the two services can be deployed and torn down independently.

### Project Structure

```
marketplace-messaging/
├── sst.config.ts              Infrastructure definition (DynamoDB, API GW WS, API GW HTTP, S3, SNS)
└── functions/
    ├── websocket/
    │   ├── connect.ts          JWT auth + connection registration
    │   ├── disconnect.ts       Connection record cleanup
    │   ├── sendMessage.ts      Persist message + fan-out delivery
    │   └── markRead.ts         Mark messages read + push update
    ├── http/
    │   ├── issueToken.ts       JWT issuance (internal API key protected)
    │   ├── createConversation.ts
    │   ├── getConversations.ts
    │   ├── getMessages.ts
    │   ├── getAttachmentUploadUrl.ts   Presigned S3 PUT
    │   ├── getAttachmentReadUrl.ts     Presigned S3 GET
    │   ├── getReactions.ts
    │   ├── toggleReaction.ts   Toggle + real-time push via WebSocket
    │   └── deleteConversation.ts
    └── lib/
        ├── auth.ts             JWT verify (jose)
        ├── db.ts               DynamoDB DocumentClient + helpers
        └── httpAuth.ts         HTTP API key middleware
```

### Deployment

```bash
# Local dev (uses SST dev mode - live Lambda tailing)
npm run dev

# Deploy to dev stage
npm run deploy

# Deploy to production (resources protected from accidental removal)
npm run deploy:prod
```

---

## marketplace-conversation-search - Search Indexing Service

> Located at `../marketplace-conversation-search`

An event-driven microservice that maintains a searchable index of conversations. It listens to domain events published by the messaging service over SNS/SQS and keeps a per-user DynamoDB search table up to date. A lightweight HTTP API exposes fuzzy-name search to the marketplace frontend.

### Architecture

```
marketplace-messaging
  │
  └── SNS Topic (conversation.created / conversation.deleted)
        │
        └── SQS Queue (retry=3, DLQ on failure)
              │
              └── Lambda: processEvent
                    │
                    ├── Unwrap SNS envelope
                    ├── Fetch participant display names from Clerk (via marketplace API)
                    └── Write/delete record in DynamoDB search table

marketplace (Next.js, server-side)
  │
  └── GET /search?q=... ──► Lambda: searchConversations
                                  │
                                  └── DynamoDB query by userId
                                      + FilterExpression on participant name
```

### Tech Stack

- **IaC / Deploy:** **SST v4 (Ion)** - multi-stage, production-protected deployments
- **Runtime:** AWS Lambda - TypeScript 6
- **Message broker:** **AWS SNS** (publisher) → **AWS SQS** (subscriber) with a Dead-Letter Queue (DLQ) after 3 failed retries
- **Database:** AWS DynamoDB - simple two-attribute primary key (`userId`, `conversationId`); filter-based name search at query time (no full-text engine needed at this scale)
- **Service discovery:** AWS SSM Parameter Store - the search service publishes its SNS topic ARN to SSM on every deploy; the messaging service reads it at Lambda cold start
- **Auth:** Internal API key (SSM SecureString), verified per-request
- **Scripts:** `tsx`-powered setup and backfill scripts for bootstrapping SSM secrets and retroactively indexing existing conversations

### Key Engineering Decisions

- **SNS → SQS fan-out pattern** - decouples the messaging service from the search service completely. The messaging Lambda fires-and-forgets a SNS publish; the search Lambda processes asynchronously with automatic retries and a DLQ for poison messages.
- **No dedicated search engine** - DynamoDB + `FilterExpression` is sufficient for participant-name search at this scale, keeping operational complexity and cost near zero.
- **DLQ for observability** - failed events are parked in a DLQ rather than silently dropped, enabling replay and debugging without data loss.
- **Cross-service secret sharing via SSM** - avoids hardcoded ARNs between services; each service owns its own SSM namespace and publishes discovery parameters there.

### Project Structure

```
marketplace-conversation-search/
├── sst.config.ts              Infrastructure (DynamoDB, SNS, SQS, DLQ, Lambda, HTTP API, SSM)
├── scripts/
│   ├── setup-ssm.ts           Bootstrap SSM secrets for a new stage
│   └── backfill.ts            Retroactively index existing conversations
└── functions/
    ├── processEvent.ts        SQS consumer - index conversation on create/delete events
    └── searchConversations.ts HTTP handler - query DynamoDB by userId + name filter
```

### Deployment

```bash
# Bootstrap SSM secrets (run once per stage)
npm run setup          # dev
npm run setup:prod     # production

# Backfill existing conversations into the search index
npm run backfill

# Deploy
npm run dev            # SST dev mode
npm run deploy         # dev stage
npm run deploy:prod    # production stage
```

---

## marketplace-notifications - Transactional Email & Currency Service

> Located at `../marketplace-notifications`

A serverless, event-driven service that owns **all transactional email** for the platform and runs scheduled background jobs. The marketplace publishes domain events to SNS; this service consumes them via SQS, hydrates them with order/recipient data via an internal HTTP callback, and dispatches localized emails through SES. It also hosts the weekly **currency-rate refresh cron** that keeps the marketplace's `CurrencyRate` table up to date.

### Architecture

```
marketplace (Next.js)
  │
  │  publish (order.completed, order.refunded, order.cod_placed,
  │           order.cod_fulfilled, order.cod_cancelled, invite.sent,
  │           member.role_changed, user.role_changed)
  ▼
SNS Topic (NotificationEventsTopic)
  │
  ▼
SQS Queue (retry=3, partial-batch failures)
  │                                   └── DLQ on exhausted retries
  ▼
Lambda: processEvent
  ├── Unwrap SNS envelope
  ├── Idempotency claim - DynamoDB conditional PutItem on `NOTIF#{eventId}` (TTL 30d)
  ├── For order.* events: GET marketplace /api/internal/order-details
  │     (returns buyer, items, shipping, sellers[] with member emails)
  ├── Render localized HTML template (en / sr / de / es)
  └── SES SendEmail
        ├── Buyer confirmation / refund / COD fulfilled / COD cancelled
        ├── Seller (org member) new-order / refund - one email per seller org
        ├── Invite emails (with accept-link)
        └── Role-change notifications (member-in-org + site-wide user role)

EventBridge Cron - every Mon 06:00 UTC
  │
  ▼
Lambda: refreshCurrencyRates
  ├── Fetch USD-base rates from fawazahmed0/exchange-api (free, CDN-hosted)
  ├── Pick EUR + RSD
  └── POST marketplace /api/internal/currency-rates → upserts CurrencyRate table
```

### Tech Stack

- **IaC / Deploy:** **SST v4 (Ion)** - multi-stage (`dev` / `production`), production resources `retain`-protected
- **Runtime:** AWS Lambda - TypeScript 6, ESM, `aws-lambda` types
- **Message broker:** **AWS SNS → SQS** with a Dead-Letter Queue after 3 failed retries; SQS configured for **partial-batch responses** so only the failing record is re-queued, not the whole batch
- **Database:** **AWS DynamoDB** - single-table idempotency / audit log. `PK = NOTIF#{eventId}`, `SK = SENT`, with a `TTL` attribute auto-purging records after 30 days. Conditional `PutItem` (`attribute_not_exists(PK)`) guarantees exactly-once email delivery even under SQS at-least-once semantics.
- **Email:** **AWS SES** - `SendEmail` / `SendRawEmail`; HTML templates rendered in-process per locale
- **Scheduler:** **EventBridge CronV2** (`cron(0 6 ? * MON *)`) for the weekly currency-rate refresh
- **Secrets / Service discovery:** AWS SSM Parameter Store (SecureString) - `SES_FROM_EMAIL`, `MARKETPLACE_API_URL`, `MARKETPLACE_API_KEY`, `APP_URL`; the service also publishes its **SNS topic ARN** to SSM (`/marketplace-notifications/{stage}/SNS_TOPIC_ARN`) so the marketplace can discover it at runtime without a hardcoded ARN.
- **Auth back to marketplace:** internal `x-api-key` header (the key lives in SSM)

### Event Catalogue

| Event | Trigger in marketplace | Recipient(s) |
|---|---|---|
| `order.completed` | Stripe webhook on `checkout.session.completed` | Buyer + each seller org |
| `order.refunded` | Stripe refund webhook | Buyer + each seller org |
| `order.cod_placed` | COD checkout completion | Buyer + each seller org |
| `order.cod_fulfilled` | Seller marks COD order fulfilled | Buyer |
| `order.cod_cancelled` | Seller / buyer cancels a COD order | Buyer |
| `invite.sent` | Org owner sends a membership invite | Invited email |
| `member.role_changed` | Owner promotes/demotes a member | Affected member |
| `user.role_changed` | Admin changes a site-wide user role (`USER`/`SELLER`/`ADMIN`) | Affected user |

All events carry an `eventId` (used for idempotency) and a `locale` so emails are rendered in the recipient's language.

### Key Engineering Decisions

- **Dedicated service, not in-process SES** - moving email out of the Next.js request path eliminates SES from the critical path of Stripe webhooks, COD checkout, invites, and role changes. The marketplace publishes-and-forgets; failures are absorbed by SQS retries and the DLQ.
- **Idempotency at the consumer** - even though SNS-to-SQS is at-least-once, the DynamoDB conditional write makes email sending exactly-once per `eventId`. Duplicate SQS deliveries are silently skipped.
- **Partial-batch responses** - `batch.size = 1` with `partialResponses: true` means an individual poison message can fail and be redriven to the DLQ without holding up healthy events.
- **Co-locating the currency cron** - the currency-rate refresher is operationally cheap and shares the same SSM / internal-API plumbing already needed for emails, so a single Lambda project hosts both. No new infra surface to maintain.
- **Localized templates over user attributes in payloads** - events carry a `locale`, not pre-rendered subject/body text, so all email copy lives in the service and can be tweaked / re-rendered without redeploying the marketplace.

### Project Structure

```
marketplace-notifications/
├── sst.config.ts                 Infrastructure (DynamoDB, SNS, SQS+DLQ, Lambda, Cron, SSM)
├── scripts/
│   └── setup-ssm.mjs             Bootstrap SSM secrets for a new stage
└── functions/
    ├── processEvent.ts           SQS consumer - dispatches all email events
    ├── refreshCurrencyRates.ts   Weekly cron - fetch FX rates + upsert via marketplace API
    ├── types.ts                  NotificationEvent union + OrderDetails / SellerGroup shapes
    └── lib/
        ├── db.ts                 DynamoDB DocumentClient + idempotency helpers
        ├── ses.ts                SES SendEmail wrapper
        ├── ssm.ts                Cached SSM parameter reads
        └── templates/            Localized HTML email templates (en / sr / de / es)
            ├── base.ts           Shared layout + i18n helpers
            ├── i18n.ts           Translation lookup
            ├── buyerOrderConfirmed.ts
            ├── buyerOrderRefunded.ts
            ├── buyerCodOrderPlaced.ts
            ├── buyerCodOrderFulfilled.ts
            ├── buyerCodOrderCancelled.ts
            ├── sellerNewOrder.ts
            ├── sellerCodNewOrder.ts
            ├── sellerOrderRefunded.ts
            ├── inviteSent.ts
            ├── memberRoleChanged.ts
            └── userRoleChanged.ts
```

### Deployment

```bash
# Bootstrap SSM secrets (run once per stage)
npm run setup

# Local dev (SST live Lambda)
npm run dev

# Deploy
npm run deploy         # dev stage
npm run deploy:prod    # production stage
```

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser / Client                         │
│  Next.js SSR/RSC pages  │  WebSocket client  │  REST calls      │
└────────────┬────────────┴────────┬───────────┴────────┬─────────┘
             │                     │                     │
             ▼                     ▼                     ▼
┌────────────────────┐  ┌──────────────────────┐  ┌─────────────────────────┐
│   marketplace      │  │ marketplace-messaging│  │marketplace-conversation │
│  (Next.js 16)      │  │  (AWS Serverless)    │  │       -search           │
│                    │  │                      │  │   (AWS Serverless)      │
│  • App Router      │  │  • WS API Gateway    │  │                         │
│  • Prisma 7 / PG   │  │  • HTTP API Gateway  │  │  • HTTP API Gateway     │
│  • Clerk auth      │  │  • DynamoDB (STD)    │  │  • DynamoDB             │
│  • Stripe + COD    │  │  • S3 attachments    │  │  • SNS/SQS consumer     │
│  • next-intl x4    │  │  • SNS publish       │◄─┤  • DLQ                  │
│  • Redis cache     │  │  • SSM secrets       │  │  • SSM secrets          │
│  • AWS S3 / SNS    │  └──────────────────────┘  └─────────────────────────┘
│  • /api/internal/* │                  │                       ▲
└──────┬─────────────┘                  │  SNS → SQS            │
       │ SNS publish                    └───────────────────────┘
       │ (order.*, invite.*, role_changed)
       ▼
┌─────────────────────────────────────────┐
│  marketplace-notifications              │
│  (AWS Serverless)                       │
│  • SNS → SQS → Lambda (+ DLQ)           │
│  • DynamoDB idempotency (TTL 30d)       │
│  • SES localized email templates        │
│  • EventBridge cron → currency refresh  │──► POST /api/internal/currency-rates
│  • SSM secrets                          │──► GET  /api/internal/order-details
└─────────────────────────────────────────┘

  PostgreSQL 17  ·  Redis  ·  Clerk  ·  Stripe  ·  AWS S3  ·  AWS SES  ·  AWS SNS/SQS
```

### Cross-Cutting Concerns

- **Multi-stage deployments** - all three services support `dev` and `production` stages via SST. Production resources are protected against accidental deletion.
- **Secret management** - no secrets in environment variables or source control. AWS SSM Parameter Store (SecureString) is the single source of truth; Lambdas fetch and cache secrets on cold start.
- **Type safety end-to-end** - TypeScript 6 (messaging & search) and TypeScript 5 strict (marketplace). Zod 4 validates all external input at runtime; `@t3-oss/env-nextjs` validates env vars at build time.
- **Zero-trust between services** - inter-service calls are authenticated via internal API keys stored in SSM. The marketplace frontend never calls the WebSocket API directly for sensitive operations.