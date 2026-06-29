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

// Cached in-process - Next.js server instances are long-lived
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

export async function publishOrderCompleted(orderId: string, locale = "en", currency = "usd"): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "order.completed",
        orderId,
        locale,
        currency,
        // Unique per-event ID for idempotency - combines orderId + type
        // so replaying the same Stripe webhook doesn't double-send emails.
        eventId: `${orderId}:order.completed`,
      }),
    })
  );
}

export async function publishCodOrderPlaced(orderId: string, locale = "en", currency = "usd"): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "order.cod_placed",
        orderId,
        locale,
        currency,
        eventId: `${orderId}:order.cod_placed`,
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

export async function publishCodOrderFulfilled(orderId: string, locale = "en"): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "order.cod_fulfilled",
        orderId,
        locale,
        eventId: `${orderId}:order.cod_fulfilled`,
      }),
    })
  );
}

export async function publishCodPaymentReceived(orderId: string, locale = "en"): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "order.cod_paid",
        orderId,
        locale,
        eventId: `${orderId}:order.cod_paid`,
      }),
    })
  );
}

export async function publishCodOrderCancelled(orderId: string, locale = "en"): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "order.cod_cancelled",
        orderId,
        locale,
        eventId: `${orderId}:order.cod_cancelled`,
      }),
    })
  );
}

export async function publishMemberRoleChanged(params: {
  userEmail: string;
  userName: string | null;
  organizationName: string;
  oldRole: string;
  newRole: string;
  locale: string;
}): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: 'member.role_changed',
        eventId: `member-role:${params.userEmail}:${params.organizationName}:${Date.now()}`,
        userEmail: params.userEmail,
        userName: params.userName,
        organizationName: params.organizationName,
        oldRole: params.oldRole,
        newRole: params.newRole,
        locale: params.locale,
      }),
    })
  );
}

export async function publishUserRoleChanged(params: {
  userEmail: string;
  userName: string | null;
  oldRole: string;
  newRole: string;
  locale: string;
}): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: 'user.role_changed',
        eventId: `user-role:${params.userEmail}:${Date.now()}`,
        userEmail: params.userEmail,
        userName: params.userName,
        oldRole: params.oldRole,
        newRole: params.newRole,
        locale: params.locale,
      }),
    })
  );
}

/**
 * Author "your review was approved/rejected" email. Fired only on an admin
 * moderation decision (not on AI auto-decisions at submit time, where the author
 * sees the outcome on the page). Recipient-targeted: renders in the AUTHOR's own
 * locale. Each decision is a distinct event (admin can re-decide), so the eventId
 * includes a timestamp rather than being collapsed per review.
 */
export async function publishReviewModerated(params: {
  userEmail: string;
  userName: string | null;
  productName: string;
  productPath: string;
  status: "APPROVED" | "REJECTED";
  rating: number;
  comment?: string | null;
  reason?: string | null;
  locale: string;
}): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "review.moderated",
        eventId: `review-mod:${params.userEmail}:${Date.now()}`,
        userEmail: params.userEmail,
        userName: params.userName,
        productName: params.productName,
        productPath: params.productPath,
        status: params.status,
        rating: params.rating,
        comment: params.comment,
        reason: params.reason,
        locale: params.locale,
      }),
    })
  );
}

// ── Fulfillment publisher ───────────────────────────────────────────────

export async function publishOrderShipped(params: {
  shipmentId: string;
  orderId: string;
  organizationId: string;
  locale: string;
  trackingNumber?: string;
  carrier?: string;
}): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "order.shipped",
        // One shipped email per shipment - re-marking tracking won't re-notify.
        eventId: `${params.shipmentId}:order.shipped`,
        orderId: params.orderId,
        organizationId: params.organizationId,
        locale: params.locale,
        trackingNumber: params.trackingNumber,
        carrier: params.carrier,
      }),
    })
  );
}

/**
 * Seller "you've been paid" email. Fired when a seller's held payout is released
 * on shipment (card orders only). One per (order, seller) - the eventId keeps it
 * idempotent against re-ships. `amount` is the seller's net (after platform fee).
 */
export async function publishPayoutReleased(params: {
  orderId: string;
  organizationId: string;
  amount: number;
  currency: string;
  locale: string;
}): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "payout.released",
        eventId: `${params.orderId}:${params.organizationId}:payout.released`,
        orderId: params.orderId,
        organizationId: params.organizationId,
        amount: params.amount,
        currency: params.currency,
        locale: params.locale,
      }),
    })
  );
}

/**
 * Buyer "your order was delivered" email. Order-level (one per order) - fired
 * once a card order is fully delivered. COD uses publishCodOrderFulfilled
 * instead (it carries the "cash now due" message).
 */
export async function publishOrderDelivered(orderId: string, locale = "en"): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "order.delivered",
        eventId: `${orderId}:order.delivered`,
        orderId,
        locale,
      }),
    })
  );
}

// ── Return / RMA publishers ─────────────────────────────────────────────
// Each return transition fires once; eventId = `${returnId}:${type}` keeps the
// notification idempotent. `locale` is the order's locale (buyer emails); seller
// emails are dispatched per-member-locale by the notifications Lambda.

type ReturnLineItem = { name: string; quantity: number; price?: number; imageUrl?: string | null };

export async function publishReturnRequested(params: {
  returnId: string;
  orderId: string;
  organizationId: string;
  locale: string;
  reason?: string;
  items?: ReturnLineItem[];
}): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "return.requested",
        eventId: `${params.returnId}:return.requested`,
        orderId: params.orderId,
        organizationId: params.organizationId,
        locale: params.locale,
        reason: params.reason,
        items: params.items,
      }),
    })
  );
}

export async function publishReturnApproved(params: {
  returnId: string;
  orderId: string;
  organizationId: string;
  locale: string;
  items?: ReturnLineItem[];
}): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "return.approved",
        eventId: `${params.returnId}:return.approved`,
        orderId: params.orderId,
        organizationId: params.organizationId,
        locale: params.locale,
        items: params.items,
      }),
    })
  );
}

export async function publishReturnRejected(params: {
  returnId: string;
  orderId: string;
  organizationId: string;
  locale: string;
  note?: string;
  items?: ReturnLineItem[];
}): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "return.rejected",
        eventId: `${params.returnId}:return.rejected`,
        orderId: params.orderId,
        organizationId: params.organizationId,
        locale: params.locale,
        note: params.note,
        items: params.items,
      }),
    })
  );
}

export async function publishReturnShipped(params: {
  returnId: string;
  orderId: string;
  organizationId: string;
  locale: string;
  items?: ReturnLineItem[];
}): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "return.shipped",
        eventId: `${params.returnId}:return.shipped`,
        orderId: params.orderId,
        organizationId: params.organizationId,
        locale: params.locale,
        items: params.items,
      }),
    })
  );
}

export async function publishReturnRefunded(params: {
  returnId: string;
  orderId: string;
  organizationId: string;
  locale: string;
  refundAmount: number;
  items?: ReturnLineItem[];
  cod?: boolean;
}): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "return.refunded",
        eventId: `${params.returnId}:return.refunded`,
        orderId: params.orderId,
        organizationId: params.organizationId,
        locale: params.locale,
        refundAmount: params.refundAmount,
        items: params.items,
        cod: params.cod,
      }),
    })
  );
}

export async function publishInviteSent(params: {
  token: string;
  email: string;
  inviteUrl: string;
  organizationName: string;
  role: string;
  locale: string;
}): Promise<void> {
  const topicArn = await getTopicArn();
  await sns.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify({
        type: "invite.sent",
        eventId: `invite:${params.token}`,
        email: params.email,
        inviteUrl: params.inviteUrl,
        organizationName: params.organizationName,
        role: params.role,
        locale: params.locale,
      }),
    })
  );
}