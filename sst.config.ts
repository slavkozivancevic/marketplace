/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST (v4 / ion) config for the marketplace Next.js app.
 *
 * The app is deployed with OpenNext (the `sst.aws.Nextjs` component) to
 * Lambda + CloudFront. Runtime config is split:
 *   - Secrets  -> `sst.Secret` (set per stage: `sst secret set <Name> <value> --stage <stage>`)
 *   - Media    -> an S3 bucket provisioned here
 *   - Sibling service URLs -> discovered from SSM Parameter Store at deploy time
 *
 * Stages == environments (dev / pr-<n> / staging / production). See DEPLOYMENT.md.
 *
 * NOTE: this is the deploy scaffold authored ahead of AWS access. Items that
 * still need a real AWS value or decision are marked `TODO(aws)`.
 */
export default $config({
  app(input) {
    return {
      name: "marketplace",
      // Keep production resources on teardown; ephemeral stages are removable.
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage ?? ""),
      home: "aws",
      providers: {
        // Same region as the sibling services so SSM discovery and SNS/SQS wiring
        // stay in-region.
        aws: { region: "eu-central-1" },
      },
    };
  },

  async run() {
    const stage = $app.stage;

    // ── Secrets ───────────────────────────────────────────────────────────
    // Set once per stage, e.g. `sst secret set DatabaseUrl <url> --stage production`.
    // Stored encrypted in SSM by SST; injected into the server function env.
    const secrets = {
      DATABASE_URL: new sst.Secret("DatabaseUrl"),
      CLERK_SECRET_KEY: new sst.Secret("ClerkSecretKey"),
      CLERK_WEBHOOK_SECRET: new sst.Secret("ClerkWebhookSecret"),
      STRIPE_SECRET_KEY: new sst.Secret("StripeSecretKey"),
      STRIPE_WEBHOOK_SECRET: new sst.Secret("StripeWebhookSecret"),
      CHAT_INTERNAL_API_KEY: new sst.Secret("ChatInternalApiKey"),
      CONVERSATION_SEARCH_API_KEY: new sst.Secret("ConversationSearchApiKey"),
      NOTIFICATIONS_API_KEY: new sst.Secret("NotificationsApiKey"),
      // Optional: AI review moderation degrades gracefully when unset. Set to an
      // empty string on stages without it.
      ANTHROPIC_API_KEY: new sst.Secret("AnthropicApiKey"),
    };

    // ── Product media bucket ──────────────────────────────────────────────
    // Public-read objects (product images/video). TODO(aws #24): put CloudFront
    // in front and swap S3_PUBLIC_URL to the CDN domain.
    const media = new sst.aws.Bucket("Media", { access: "public" });
    const mediaPublicUrl = $interpolate`https://${media.name}.s3.eu-central-1.amazonaws.com`;

    // ── Cross-service discovery (SSM) ─────────────────────────────────────
    // The sibling services publish their consumer-facing URLs to SSM (same
    // convention as their topic-ARN params). Read them at deploy time so the
    // app env is wired without hardcoding per-stage URLs.
    const chatHttpApiUrl = aws.ssm.getParameterOutput({
      name: `/marketplace-messaging/${stage}/HTTP_API_URL`,
    }).value;
    const conversationSearchApiUrl = aws.ssm.getParameterOutput({
      name: `/marketplace-conversation-search/${stage}/SEARCH_API_URL`,
    }).value;

    // The app reads the notifications topic ARN from THIS param name at runtime
    // (env var carries the param path, not the ARN itself).
    const notificationsTopicArnParam = `/marketplace-notifications/${stage}/SNS_TOPIC_ARN`;

    // ── The Next.js site (OpenNext -> Lambda + CloudFront) ────────────────
    const web = new sst.aws.Nextjs("Web", {
      link: [media, ...Object.values(secrets)],
      // TODO(aws #31): attach the real domain per stage (production apex +
      // staging/pr subdomains). Drives APP_URL below (canonical/hreflang/OG).
      // domain: stage === "production" ? "example.com" : `${stage}.example.com`,
      environment: {
        // Secrets
        DATABASE_URL: secrets.DATABASE_URL.value,
        CLERK_SECRET_KEY: secrets.CLERK_SECRET_KEY.value,
        CLERK_WEBHOOK_SECRET: secrets.CLERK_WEBHOOK_SECRET.value,
        STRIPE_SECRET_KEY: secrets.STRIPE_SECRET_KEY.value,
        STRIPE_WEBHOOK_SECRET: secrets.STRIPE_WEBHOOK_SECRET.value,
        CHAT_INTERNAL_API_KEY: secrets.CHAT_INTERNAL_API_KEY.value,
        CONVERSATION_SEARCH_API_KEY: secrets.CONVERSATION_SEARCH_API_KEY.value,
        NOTIFICATIONS_API_KEY: secrets.NOTIFICATIONS_API_KEY.value,
        ANTHROPIC_API_KEY: secrets.ANTHROPIC_API_KEY.value,

        // Media (S3)
        S3_BUCKET_NAME: media.name,
        S3_PUBLIC_URL: mediaPublicUrl,

        // Cross-service
        CHAT_HTTP_API_URL: chatHttpApiUrl,
        CONVERSATION_SEARCH_API_URL: conversationSearchApiUrl,
        NOTIFICATIONS_TOPIC_ARN_PARAM: notificationsTopicArnParam,

        // App URL. TODO(aws): replace with the mapped domain once set; until then
        // OpenNext exposes the CloudFront URL via `web.url` (see outputs).
        APP_URL: process.env.APP_URL ?? "http://localhost:3000",

        // The build validates env with zod; a deploy build only has secrets +
        // links, so skip the full check (runtime still has every value).
        SKIP_ENV_VALIDATION: "1",

        // NOTE: AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are
        // injected automatically by the Lambda runtime from the execution role -
        // do NOT set them here (AWS_REGION is reserved).
        // TODO(aws): the app's S3/SNS/SSM clients must use the default credential
        // provider chain (role temp creds include a session token). If any client
        // passes accessKeyId/secretAccessKey explicitly without sessionToken, it
        // will fail on Lambda - switch those to the default chain.
      },
      transform: {
        // Grant the server function the IAM it needs beyond the linked bucket:
        // read sibling SSM params + publish order/lifecycle events to the
        // notifications SNS topic.
        server: {
          permissions: [
            {
              actions: ["ssm:GetParameter", "ssm:GetParameters"],
              resources: [
                `arn:aws:ssm:eu-central-1:*:parameter/marketplace-notifications/${stage}/*`,
                `arn:aws:ssm:eu-central-1:*:parameter/marketplace-messaging/${stage}/*`,
                `arn:aws:ssm:eu-central-1:*:parameter/marketplace-conversation-search/${stage}/*`,
              ],
            },
            {
              actions: ["sns:Publish"],
              resources: [`arn:aws:sns:eu-central-1:*:marketplace-notifications-${stage}-*`],
            },
          ],
        },
      },
    });

    // Close the callback loop: the notifications + conversation-search Lambdas
    // call back into the app's /api/internal/* endpoints, reading the app URL
    // from a param in THEIR OWN namespace. Publish web.url there so the mesh is
    // wired automatically on deploy (public URL -> plain String).
    new aws.ssm.Parameter("NotificationsMarketplaceApiUrl", {
      name: `/marketplace-notifications/${stage}/MARKETPLACE_API_URL`,
      type: "String",
      value: web.url,
    });
    new aws.ssm.Parameter("SearchMarketplaceApiUrl", {
      name: `/marketplace-conversation-search/${stage}/MARKETPLACE_API_URL`,
      type: "String",
      value: web.url,
    });

    return {
      url: web.url,
      mediaBucket: media.name,
    };
  },
});
