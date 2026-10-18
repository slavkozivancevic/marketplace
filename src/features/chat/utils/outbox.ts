import type { ChatAttachment } from "../types";

export type OutboxStatus =
  | "queued"
  | "sending"
  /**
   * Confirmed by the server and already in the thread under its real id. The
   * entry outlives the acknowledgement by a moment on purpose - see
   * `deliveredAs`.
   */
  | "delivered"
  | "failed";

/** Why an entry stopped trying. Each one reads differently to the user. */
export type OutboxFailure =
  /** The server said it will never take this one. */
  | "rejected"
  /** Its attachments have been swept from S3, so it can no longer be sent. */
  | "expired"
  /** We tried, repeatedly, and never heard back. */
  | "retries";

export interface OutboxEntry {
  /** Our id for the message, stable across retries - the server deduplicates on it. */
  clientMsgId: string;
  conversationId: string;
  text: string;
  attachments: ChatAttachment[];
  /** The sender's clock. Orders the queue and dates the bubble until the ack lands. */
  createdAt: string;
  /** Only ever incremented by a real attempt over an open socket. */
  attempts: number;
  status: OutboxStatus;
  failedReason?: OutboxFailure;
  /** Epoch ms before which a queued entry must not be retried. */
  nextAttemptAt?: number;
  /** Epoch ms the current attempt went out, which is what the ack timeout measures. */
  sentAt?: number;
  /**
   * The id the message was persisted under, once acknowledged.
   *
   * It exists so the handover has no gap. The queued bubble and the persisted
   * one live in different stores - this queue and the query cache - and those
   * two do not update the component in the same frame: the cache notifies
   * through a microtask while this store notifies synchronously. Dropping the
   * entry on acknowledgement therefore left a frame with neither, and the
   * message visibly blinked out and back.
   *
   * So the entry stays until the real message is actually on screen, and this
   * is the link that lets the thread recognise the two as the same message and
   * render one of them.
   */
  deliveredAs?: string;
}

/** Attempts over an open socket before we stop and tell the user. */
export const MAX_ATTEMPTS = 5;
/** How long an attempt waits for its ack before it counts as lost. */
export const ACK_TIMEOUT_MS = 10_000;

/**
 * Silence on the socket before we go looking for a pulse.
 *
 * Only silence triggers it, so a conversation that is actually being used
 * never sends a probe at all.
 */
export const HEARTBEAT_IDLE_MS = 30_000;

/**
 * Silence before we stop believing the socket.
 *
 * A WebSocket whose network has gone does not close, error, or change
 * `readyState` - it simply stops carrying traffic while reporting itself OPEN.
 * Nothing in the browser will ever say otherwise, so this is where we decide
 * for ourselves and reconnect. It has to leave room for the probe sent at
 * `HEARTBEAT_IDLE_MS` to make a round trip.
 */
export const CONNECTION_DEAD_MS = 45_000;

/**
 * How long a message with attachments may sit in the queue.
 *
 * Uploads are tagged `lifecycle=pending` and the bucket sweeps them after a
 * day; the tag is only removed when the message is written. So an entry older
 * than this would send keys that no longer resolve to anything, and the right
 * answer is to say so rather than deliver an empty frame.
 */
export const ATTACHMENT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Exponential, capped: 2s, 4s, 8s, 16s, 32s.
 *
 * Only ever applies between failed attempts on a live socket. Being offline
 * does not consume attempts or backoff at all - there is nothing to back off
 * from, and the queue simply waits for the connection.
 */
export function backoffDelay(attempts: number): number {
  return Math.min(2_000 * 2 ** Math.max(0, attempts - 1), 60_000);
}

/**
 * True once a message's attachments can no longer be relied on.
 *
 * Text has no such ceiling: a message with no attachments can wait as long as
 * it has to.
 */
export function hasExpired(entry: OutboxEntry, now: number): boolean {
  if (entry.attachments.length === 0) return false;
  const age = now - Date.parse(entry.createdAt);
  return Number.isFinite(age) && age > ATTACHMENT_MAX_AGE_MS;
}

/** True when an attempt has been out longer than we are willing to wait. */
export function hasStalled(entry: OutboxEntry, now: number): boolean {
  return (
    entry.status === "sending" &&
    entry.sentAt !== undefined &&
    now - entry.sentAt > ACK_TIMEOUT_MS
  );
}

/**
 * The entries that should go out right now - at most one per conversation.
 *
 * Order inside a conversation is part of what a conversation means, so each one
 * is drained strictly in the order its messages were written and blocks on its
 * own head. A head that is still awaiting an ack, or that has given up, holds
 * everything behind it: sending the next message past a stuck one would deliver
 * the conversation out of order, which is worse than delivering it late.
 *
 * Conversations do not block each other.
 */
export function dueEntries(entries: OutboxEntry[], now: number): OutboxEntry[] {
  const heads = new Map<string, OutboxEntry>();
  for (const entry of entries) {
    // A delivered entry is finished business, waiting only to be swept. It must
    // not count as the head, or it would hold up the message behind it.
    if (entry.status === "delivered") continue;
    if (!heads.has(entry.conversationId)) heads.set(entry.conversationId, entry);
  }

  return [...heads.values()].filter(
    (head) =>
      head.status === "queued" && (head.nextAttemptAt ?? 0) <= now,
  );
}
