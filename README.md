# Marketplace

Multi-tenant e-commerce marketplace built with Next.js 16, Prisma, and PostgreSQL. Organizations (sellers) can list products with variants, images, and stock; customers browse, add to cart, and check out via Stripe.

## Tech stack

- **Framework:** Next.js 16 (App Router, React 19, React Compiler)
- **Language:** TypeScript
- **Database:** PostgreSQL via Prisma 7 (`@prisma/adapter-pg`)
- **Auth:** Clerk (`@clerk/nextjs`) with Svix webhooks for user sync
- **Payments:** Stripe Checkout + webhooks
- **Storage:** AWS S3 (presigned uploads, `sharp` image processing)
- **Email:** AWS SES
- **Cache / queues:** Redis (`ioredis`)
- **UI:** Tailwind CSS 4, Radix UI, shadcn, `lucide-react`, Embla Carousel, `next-themes`
- **Forms & validation:** `react-hook-form`, `zod`, `@hookform/resolvers`
- **State:** Zustand
- **DnD:** `@dnd-kit` (for ordering images, variants, etc.)
- **Env validation:** `@t3-oss/env-nextjs`

## Project structure

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

## Data model (high level)

Defined in [prisma/schema.prisma](prisma/schema.prisma):

- **User** — synced from Clerk (`clerkUserId`), with `UserRole` (`USER` / `ADMIN` / `SELLER`) and an `activeOrgId`.
- **Organization / Membership / Invite** — multi-tenant sellers. Members have a `MembershipRole` (`OWNER` / `ADMIN` / `MEMBER`). Invites are token-based with expiry and `InviteStatus`.
- **Product** — belongs to an `Organization`, has `ProductStatus` (`DRAFT` / `PUBLISHED` / `ARCHIVED`), optional stock, versioning, soft-delete (`deletedAt`), and audit fields (`createdById`, `updatedById`).
- **ProductHistory** — snapshot per version for audit.
- **ProductVariant / VariantOption / VariantOptionValue** — flexible variant matrix (e.g. size × color) with per-variant SKU, price, and stock.
- **ProductImage** — S3-backed (`url`, `key`) with ordering.
- **Order / OrderItem** — linked to Stripe session (`stripeSessionId`), with `OrderStatus` (`PENDING` / `COMPLETED` / `CANCELLED` / `REFUNDED`).
- **WebhookEvent** — idempotency tracking for external webhooks.

## Prerequisites

- Node.js 20+
- Docker (for the bundled PostgreSQL) or an existing PostgreSQL 17 instance
- A Redis instance
- Clerk, Stripe, and AWS (S3 + SES) accounts

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

A Postgres 17 container is provided:

```bash
docker compose up -d
```

It exposes Postgres on `localhost:5433` (see [docker-compose.yml](docker-compose.yml)).

### 3. Environment variables

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

SES_FROM_EMAIL=
APP_URL="http://localhost:3000"

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
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

### 4. Run database migrations

```bash
npm run db:migrate
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

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

## Webhooks

External services hit the following routes — expose them via a tunnel (e.g. `ngrok`, `stripe listen`) during local dev:

- **Clerk → `/api/webhooks/clerk`** — syncs users/sessions (verified with `svix`, secret: `CLERK_WEBHOOK_SECRET`).
- **Stripe → `/api/webhooks/stripe`** — checkout completion, payment, refunds, etc. (secret: `STRIPE_WEBHOOK_SECRET`).

## Routing overview

- `(public)` — storefront: home, product listing/detail, cart, checkout
- `(auth)` — Clerk sign-in / sign-up
- `(dashboard)` — authenticated seller dashboard
- `admin/` — admin panel for managing organizations, products, and users
- `invite/` — accept organization invites
- `api/uploads` — presigned S3 upload endpoints
- `api/admin`, `api/clerk`, `api/webhooks`, `api/test` — internal and integration endpoints
