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
      // Publishable keys - public by design, but per-stage, so kept as secrets.
      // Baked into the client bundle at build time (NEXT_PUBLIC_).
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: new sst.Secret("ClerkPublishableKey"),
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: new sst.Secret("StripePublishableKey"),
      // App's own public URL (per-stage): the CloudFront URL now, the custom
      // domain later. Can't be `web.url` (self-reference), so it's a set secret.
      APP_URL: new sst.Secret("AppUrl"),
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
    // Chat websocket URL for the client bundle (baked at build via NEXT_PUBLIC_).
    const chatWsUrl = aws.ssm.getParameterOutput({
      name: `/marketplace-messaging/${stage}/WS_API_URL`,
    }).value;

    // The app reads the notifications topic ARN from THIS param name at runtime
    // (env var carries the param path, not the ARN itself).
    const notificationsTopicArnParam = `/marketplace-notifications/${stage}/SNS_TOPIC_ARN`;

    // ── The Next.js site (OpenNext -> Lambda + CloudFront) ────────────────
    const web = new sst.aws.Nextjs("Web", {
      // SST pins OpenNext 3.9.14 for Next 15+, which predates full Next.js 16
      // support (the middleware -> `proxy` rename + Node.js proxy runtime).
      // 3.9.14 doesn't propagate the proxy/Clerk auth context to the render, so
      // server-side auth() fails ("can't detect clerkMiddleware") and pages render
      // blank. Pin a newer OpenNext that supports Next 16. Fallback: 3.10.4.
      openNextVersion: "4.0.3",
      link: [media, ...Object.values(secrets)],
      // Domain: marketverseapp.com (registered at Namecheap, DNS delegated to
      // this account's Route 53 hosted zone - SST assumes Route 53 by default).
      // TEMPORARY: apex is on `staging` because that's the stage currently
      // serving as prod (see DEPLOYMENT.md / project_staging_deployed memory).
      // When a real `production` stage is deployed, remap: production -> apex,
      // staging -> a subdomain (e.g. staging.marketverseapp.com) - both stages
      // must never claim the same domain at once (Route 53 alias conflict).
      domain: stage === "staging" ? "marketverseapp.com" : undefined,
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

        // Client bundle (NEXT_PUBLIC_, baked at build time by OpenNext). The
        // client env schema has no skipValidation, so these MUST be present.
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.value,
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: secrets.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.value,
        NEXT_PUBLIC_S3_PUBLIC_URL: mediaPublicUrl,
        NEXT_PUBLIC_CHAT_WS_URL: chatWsUrl,
        NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
        NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
        NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: "/",
        NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: "/",

        // App's own public URL (drives canonical/OG/sitemap + Stripe checkout
        // redirect URLs). Set per stage: `sst secret set AppUrl <url> --stage ...`.
        APP_URL: secrets.APP_URL.value,

        // Stripe Connect stays mocked until there's an EU IBAN. This MUST be set
        // explicitly: the Lambda runs with NODE_ENV=production, so MOCK_CONNECT
        // would otherwise default to false and the app would attempt real
        // transfers/onboarding. Flip to "false" once Stripe Connect is live.
        MOCK_STRIPE_CONNECT: "true",

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
        // APPEND to the server function's IAM (do NOT replace it - the object
        // form would drop OpenNext's own grants, incl. the ISR cache S3 bucket).
        // Use the function form to extend the existing permissions array:
        // read sibling SSM params + publish lifecycle events to the notifications
        // SNS topic.
        server: (args) => {
          args.permissions = $output(args.permissions ?? []).apply((perms) => [
            ...perms,
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
          ]);
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
