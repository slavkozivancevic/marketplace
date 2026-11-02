import type { ChatMessage, ReplyQuote } from "../types";

/** The same cut the server makes for a quote (lib/replies.ts in messaging). */
export const EXCERPT_LENGTH = 120;

/**
 * The quote of `message` as the server will snapshot it - drawn in the
 * outbox bubble until the ack brings the server's own copy, which replaces
 * it. Never sent: the server is given the key only.
 */
export function quoteOf(message: Pick<ChatMessage, "messageId" | "createdAt" | "senderId" | "text" | "attachments">): ReplyQuote {
  const first = message.attachments[0];
  return {
    messageId: message.messageId,
    createdAt: message.createdAt,
    senderId: message.senderId,
    ...(message.text ? { excerpt: message.text.slice(0, EXCERPT_LENGTH) } : {}),
    ...(first ? { attachment: { key: first.key, type: first.type, ...(first.filename ? { filename: first.filename } : {}) } } : {}),
  };
}
