import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    CLERK_SECRET_KEY: z.string().min(1),
    CLERK_WEBHOOK_SECRET: z.string().min(1),
    AWS_REGION: z.string().min(1),
    AWS_ACCESS_KEY_ID: z.string().min(1),
    AWS_SECRET_ACCESS_KEY: z.string().min(1),
    S3_BUCKET_NAME: z.string().min(1),
    S3_PUBLIC_URL: z.string().min(1),
    APP_URL: z.url(),
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    // Dev escape hatch: when "true", Stripe Connect onboarding and payout
    // transfers are simulated locally (no real account / IBAN / transfer call).
    // Leave unset in production to use the real Stripe Connect flow.
    MOCK_STRIPE_CONNECT: z.enum(["true", "false"]).optional(),
    CHAT_HTTP_API_URL: z.string().min(1),
    // Internal service-auth keys below are per-stage shared secrets: each pairs
    // with the matching service's SSM key and must be rotated in lockstep per
    // stage (dev/staging/production).
    CHAT_INTERNAL_API_KEY: z.string().min(1),
    CONVERSATION_SEARCH_API_URL: z.string().min(1),
    CONVERSATION_SEARCH_API_KEY: z.string().min(1),
    NOTIFICATIONS_TOPIC_ARN_PARAM: z.string().min(1),
    NOTIFICATIONS_API_KEY: z.string().min(1),
    // Optional: enables AI review moderation (Anthropic Claude Haiku). When
    // unset, submitted reviews stay PENDING and are moderated manually by an
    // admin - the feature degrades gracefully with no standing cost.
    ANTHROPIC_API_KEY: z.string().optional(),
  },
  experimental__runtimeEnv: process.env,
  // Skip full validation for integration tests / CI builds that only need a
  // subset of vars (e.g. DATABASE_URL). Set SKIP_ENV_VALIDATION=1.
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
