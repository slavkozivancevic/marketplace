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
    // Browser PUTs directly to this bucket via presigned URLs (product image/
    // video upload), so CORS matters. Only `staging` (the domain-facing stage)
    // is locked to the real origin; dev/pr-<n> have no stable origin ahead of
    // time and keep SST's default wildcard.
    const media = new sst.aws.Bucket("Media", {
      access: "public",
      cors: { allowOrigins: stage === "staging" ? ["https://marketverseapp.com"] : ["*"] },
    });
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

    // ── Log settings shared by every OpenNext function ────────────────────
    // Retention: SST already defaults to "1 month" (nothing is kept forever),
    // but 14 days halves the stored volume and matches the window Grafana
    // Cloud's free tier keeps - beyond it a dashboard could only show gaps.
    // Ingestion is the metered part and 5 GB/month is free (ROADMAP #23).
    //
    // Format: "text" is the default and stays. Worth knowing why, because the
    // raw log events look like they should break our metric filters:
    //
    //   2026-08-23T10:49:21.269Z\t<requestId>\tINFO\t{"msg":"request",...}
    //
    // The Node runtime prefixes every console call, so the event does NOT start
    // with `{`. CloudWatch still parses the embedded JSON: verified against the
    // live staging log group with `aws logs test-metric-filter`, including that
    // `{ $.msg = "request" && $.status >= 500 }` matches a 500 and not a 200 -
    // i.e. real JSON evaluation, not substring matching. Non-JSON lines (Next's
    // build output, START/END/REPORT) match nothing, as intended.
    //
    // Lambda's "json" format would instead nest everything under a `message`
    // key, so every filter pattern below would have to be rewritten. Changing
    // this flips a switch under eight metrics that have no compile-time link to
    // it - so if it ever changes, re-run those test-metric-filter checks first.
    const fnLogging = { retention: "2 weeks", format: "text" } as const;

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
          args.logging = fnLogging;
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
        // The other OpenNext functions get the same log settings. They are far
        // quieter than `server`, but they share the 5 GB/month free tier.
        imageOptimizer: (args) => {
          args.logging = fnLogging;
        },
        revalidationSeeder: (args) => {
          args.logging = fnLogging;
        },
        revalidationEventsSubscriber: (args) => {
          args.logging = fnLogging;
        },
      },
    });

    // ── Observability: metrics + alarms (ROADMAP #23) ────────────────────
    //
    // CloudWatch is the source of truth; Grafana Cloud only reads it. That is
    // not a preference - CodeDeploy (ROADMAP #31c) can watch CloudWatch alarms
    // and nothing else, so the metrics that gate a rollback have to live here.
    //
    // No custom-metric code runs in the app. Metric filters lift numbers out of
    // the JSON log lines it already writes (src/lib/logger.ts), which costs the
    // same as Embedded Metric Format but needs no instrumentation library.
    //
    // BUDGET - the free tier is 10 custom metrics and 10 alarm metrics, and we
    // stay inside it deliberately (see ROADMAP #23): 8 filters, 8 alarms, no
    // composite alarm (those are $0.50/month and CodeDeploy accepts a plain
    // list of up to 10 alarms anyway). Dimensions are the trap here: making
    // `model` or `route` a dimension would multiply one metric into dozens at
    // $0.30 each. High-cardinality questions ("which model is slow?") are
    // answered from the logs with Logs Insights instead, for free.
    //
    // Declared out here so its ARN can be surfaced as a stack output - it is
    // the one value that has to be pasted back into Grafana by hand.
    let grafanaReader: aws.iam.Role | undefined;

    // Real stages only. `sst dev` runs the app locally - there is no deployed
    // log group to attach to, and alarms for a laptop are noise.
    if (stage === "staging" || stage === "production") {
      const namespace = `MarketVerse/${stage}`;

      // Both assertions are safe under the stage guard above. `server` is
      // optional in the type because `sst dev` runs the app locally instead of
      // deploying a function, and `logGroup` is absent only when logging is
      // turned off - which the `fnLogging` transform above explicitly does not
      // do. Neither case can reach this branch.
      const server = web.nodes.server!;
      const logGroupName = server.nodes.logGroup.apply((group) => group!.name);
      const serverFunctionName = server.nodes.function.name;

      /**
       * Counts matching log lines. `value: "1"` means "one per match", so the
       * alarm reads it with SUM.
       */
      const countMetric = (name: string, pattern: string) =>
        new aws.cloudwatch.LogMetricFilter(`Metric${name}`, {
          logGroupName,
          pattern,
          metricTransformation: { namespace, name, value: "1", unit: "Count" },
        });

      /**
       * Lifts a number out of the matched line, so CloudWatch keeps the raw
       * distribution and can answer p95/p99 server-side.
       *
       * No `defaultValue` on purpose: it would publish a 0 for every
       * non-matching log event and drag every percentile toward zero. Alarms
       * cover the resulting gaps with `treatMissingData: "notBreaching"`.
       */
      const valueMetric = (name: string, pattern: string, value: string, unit: string) =>
        new aws.cloudwatch.LogMetricFilter(`Metric${name}`, {
          logGroupName,
          pattern,
          metricTransformation: { namespace, name, value, unit },
        });

      // The four numbers carried by the one summary line per observed request.
      valueMetric("RequestDurationMs", '{ $.msg = "request" }', "$.durationMs", "Milliseconds");
      valueMetric("DbTimeMs", '{ $.msg = "request" }', "$.dbMs", "Milliseconds");
      valueMetric("QueriesPerRequest", '{ $.msg = "request" }', "$.dbQueries", "Count");
      countMetric("Http5xx", '{ $.msg = "request" && $.status >= 500 }');

      // Failure signals. `event` is the stable field the app tags its failure
      // branches with - see captureError(...) in the checkout actions and the
      // Stripe webhook.
      countMetric("AppErrors", '{ $.level = "error" }');
      countMetric("SlowQueries", '{ $.msg = "slow_query" }');
      countMetric("CheckoutFailures", '{ $.event = "checkout_failed" }');
      countMetric("WebhookFailures", '{ $.event = "webhook_failed" }');

      // Alarms notify this topic. The email subscription is deliberately NOT in
      // IaC: SNS email subscriptions sit in `PendingConfirmation` until a human
      // clicks the link in the mail, so declaring one here would look
      // provisioned while delivering nothing. Subscribe once per stage in the
      // console (SNS -> Topics -> this topic -> Create subscription).
      const alarms = new aws.sns.Topic("AlarmTopic", {
        name: `marketplace-${stage}-alarms`,
      });

      const alarm = (
        name: string,
        args: Omit<aws.cloudwatch.MetricAlarmArgs, "alarmName" | "alarmActions" | "okActions">,
      ) =>
        new aws.cloudwatch.MetricAlarm(name, {
          name: `marketplace-${stage}-${name}`,
          alarmActions: [alarms.arn],
          okActions: [alarms.arn],
          // Silence is health: with staging traffic most periods have no data
          // at all, and the default (INSUFFICIENT_DATA) would make every alarm
          // permanently amber and useless as a deployment gate.
          treatMissingData: "notBreaching",
          ...args,
        });

      // Money path: one failed webhook can mean a paid order that never ships.
      alarm("WebhookFailures", {
        namespace,
        metricName: "WebhookFailures",
        statistic: "Sum",
        comparisonOperator: "GreaterThanOrEqualToThreshold",
        threshold: 1,
        period: 300,
        evaluationPeriods: 1,
        alarmDescription: "A Stripe webhook failed to process.",
      });

      alarm("CheckoutFailures", {
        namespace,
        metricName: "CheckoutFailures",
        statistic: "Sum",
        comparisonOperator: "GreaterThanOrEqualToThreshold",
        threshold: 1,
        period: 300,
        evaluationPeriods: 1,
        alarmDescription: "Checkout raised a fault (not a business rejection).",
      });

      alarm("Http5xx", {
        namespace,
        metricName: "Http5xx",
        statistic: "Sum",
        comparisonOperator: "GreaterThanOrEqualToThreshold",
        threshold: 3,
        period: 300,
        evaluationPeriods: 1,
        alarmDescription: "Observed routes are returning 5xx.",
      });

      alarm("AppErrors", {
        namespace,
        metricName: "AppErrors",
        statistic: "Sum",
        comparisonOperator: "GreaterThanOrEqualToThreshold",
        threshold: 5,
        period: 300,
        evaluationPeriods: 1,
        alarmDescription: "Error-level log volume is elevated.",
      });

      // Latency as a percentile, not an average: an average hides the slow tail
      // that users actually feel.
      alarm("RequestLatencyP95", {
        namespace,
        metricName: "RequestDurationMs",
        extendedStatistic: "p95",
        comparisonOperator: "GreaterThanThreshold",
        threshold: 3000,
        period: 300,
        evaluationPeriods: 2,
        alarmDescription: "p95 request latency above 3s for 10 minutes.",
      });

      // N+1 detector. Maximum, not average - a single request issuing hundreds
      // of queries is the bug, and averaging it against healthy traffic buries
      // it. The threshold lives here rather than in the app precisely so it can
      // be retuned without a deploy.
      alarm("QueriesPerRequest", {
        namespace,
        metricName: "QueriesPerRequest",
        statistic: "Maximum",
        comparisonOperator: "GreaterThanThreshold",
        threshold: 30,
        period: 900,
        evaluationPeriods: 1,
        alarmDescription: "A request issued an unusual number of queries (N+1 suspect).",
      });

      // The two AWS-native metrics: free, and they catch what our own logger
      // cannot - a function that died before it could log (timeout, OOM, a
      // failed init) never writes an error line.
      alarm("LambdaErrors", {
        namespace: "AWS/Lambda",
        metricName: "Errors",
        dimensions: { FunctionName: serverFunctionName },
        statistic: "Sum",
        comparisonOperator: "GreaterThanOrEqualToThreshold",
        threshold: 5,
        period: 300,
        evaluationPeriods: 1,
        alarmDescription: "Server function invocations are failing.",
      });

      alarm("LambdaThrottles", {
        namespace: "AWS/Lambda",
        metricName: "Throttles",
        dimensions: { FunctionName: serverFunctionName },
        statistic: "Sum",
        comparisonOperator: "GreaterThanThreshold",
        threshold: 0,
        period: 300,
        evaluationPeriods: 1,
        alarmDescription: "Server function is being throttled (concurrency limit).",
      });

      // ── Grafana Cloud read access ──────────────────────────────────────
      //
      // Grafana Cloud is the dashboard layer only; it reads CloudWatch and
      // stores nothing. It authenticates by assuming this role - no access key
      // ever leaves AWS, and nothing here can write.
      //
      // The external ID is the guard against the confused-deputy problem: the
      // role ARN is not a secret, and without this condition anyone else's
      // Grafana stack could ask Grafana's shared AWS account to assume it. Both
      // values below come from the data source's own setup panel and are
      // specific to the `marketverse` stack - recreating that stack issues a new
      // external ID, and this must be updated to match or the connection dies.
      const GRAFANA_CLOUD_AWS_ACCOUNT_ID = "008923505280";
      const GRAFANA_STACK_EXTERNAL_ID = "1805821";

      const accountId = aws.getCallerIdentityOutput().accountId;

      grafanaReader = new aws.iam.Role("GrafanaCloudWatchReader", {
        name: `marketplace-${stage}-grafana-cloudwatch-reader`,
        description: "Read-only CloudWatch access for the Grafana Cloud data source.",
        assumeRolePolicy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: `arn:aws:iam::${GRAFANA_CLOUD_AWS_ACCOUNT_ID}:root` },
              Action: "sts:AssumeRole",
              Condition: { StringEquals: { "sts:ExternalId": GRAFANA_STACK_EXTERNAL_ID } },
            },
          ],
        }),
      });

      new aws.iam.RolePolicy("GrafanaCloudWatchReaderPolicy", {
        role: grafanaReader.id,
        policy: accountId.apply((id) =>
          JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                // CloudWatch metrics and alarms have no resource-level
                // permissions to scope to - these actions are all-or-nothing on
                // "*". They are read-only, so the blast radius is visibility.
                Sid: "ReadMetricsAndAlarms",
                Effect: "Allow",
                Action: [
                  "cloudwatch:ListMetrics",
                  "cloudwatch:GetMetricData",
                  "cloudwatch:GetMetricStatistics",
                  "cloudwatch:DescribeAlarms",
                  "cloudwatch:DescribeAlarmHistory",
                  "cloudwatch:DescribeAlarmsForMetric",
                  "tag:GetResources",
                ],
                Resource: "*",
              },
              {
                // Listing has to be account-wide for the log-group picker to
                // enumerate anything at all...
                Sid: "ListLogGroups",
                Effect: "Allow",
                Action: ["logs:DescribeLogGroups"],
                Resource: "*",
              },
              {
                // ...but actually reading log CONTENT is scoped to this app's
                // own log groups. Grafana can query our Lambdas and nothing
                // else in the account.
                Sid: "QueryOwnLogs",
                Effect: "Allow",
                Action: [
                  "logs:GetLogGroupFields",
                  "logs:StartQuery",
                  "logs:StopQuery",
                  "logs:GetQueryResults",
                  "logs:GetLogEvents",
                ],
                Resource: [
                  `arn:aws:logs:eu-central-1:${id}:log-group:/aws/lambda/marketplace-${stage}-*`,
                  `arn:aws:logs:eu-central-1:${id}:log-group:/aws/lambda/marketplace-${stage}-*:*`,
                ],
              },
            ],
          }),
        ),
      });
    }

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
      ...(grafanaReader ? { grafanaRoleArn: grafanaReader.arn } : {}),
    };
  },
});
