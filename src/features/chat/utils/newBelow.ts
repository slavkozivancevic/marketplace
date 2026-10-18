import type { ChatMessage } from "../types";

/**
 * How many messages from other people have landed since the moment the reader
 * left the live end of the thread.
 *
 * `detachedAt` is the timestamp of the newest message at the instant they
 * scrolled up, so the count answers exactly the question the badge asks: what
 * is waiting below the fold. It is deliberately not derived from `readBy` - an
 * open conversation marks everything read on arrival, so read receipts would
 * zero the badge while the messages are still off-screen.
 *
 * Timestamps are compared as instants rather than strings: a message's
 * `createdAt` comes either from the Lambda or, for an unconfirmed one, from the
 * sender's own clock, and the two formats need not be byte-identical.
 *
 * Our own messages never count. Sending re-pins the view to the bottom, so a
 * message we wrote can only be "below" if it came from another device - and
 * calling that a new message to catch up on would be odd.
 */
export function countNewBelow(
  messages: Pick<ChatMessage, "senderId" | "createdAt">[],
  detachedAt: string,
  currentUserId: string,
): number {
  const since = Date.parse(detachedAt);
  if (Number.isNaN(since)) return 0;

  let count = 0;
  for (const m of messages) {
    if (m.senderId === currentUserId) continue;
    if (Date.parse(m.createdAt) > since) count += 1;
  }
  return count;
}
