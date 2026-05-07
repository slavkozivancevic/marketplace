import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { env } from "@/env/server";

const sns = new SNSClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const ssm = new SSMClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

// Cached in-process — Next.js server instances are long-lived
let _topicArn: string | undefined;

async function getTopicArn(): Promise<string> {
  if (_topicArn) return _topicArn;
  const result = await ssm.send(
    new GetParameterCommand({ Name: env.NOTIFICATIONS_TOPIC_ARN_PARAM })
  );
  const arn = result.Parameter?.Value;
  if (!arn) throw new Error("NOTIFICATIONS_TOPIC_ARN_PARAM not found in SSM");
  _topicArn = arn;
  return arn;
}

// ── Event publishers ──────────────────────────────────────────────────────

export async function publishOrderCompleted(orderId: string, locale = "en"): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "order.completed",
        orderId,
        locale,
        // Unique per-event ID for idempotency — combines orderId + type
        // so replaying the same Stripe webhook doesn't double-send emails.
        eventId: `${orderId}:order.completed`,
      }),
    })
  );
}

export async function publishOrderRefunded(orderId: string, locale = "en"): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "order.refunded",
        orderId,
        locale,
        eventId: `${orderId}:order.refunded`,
      }),
    })
  );
}