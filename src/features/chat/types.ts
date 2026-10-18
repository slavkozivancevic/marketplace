// emoji → userIds[]
export type ReactionMap = Record<string, string[]>;

export interface ChatAttachment {
  key: string;
  type: string;
  width?: number;
  height?: number;
  filename?: string;
  size?: number;
}

export interface ChatMessage {
  messageId: string;
  conversationId: string;
  senderId: string;
  text: string;
  attachments: ChatAttachment[];
  readBy: string[];
  createdAt: string;
  // SK in DynamoDB - needed for markRead
  sk?: string;
}

export interface Conversation {
  conversationId: string;
  participants: string[];
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageSenderId?: string;
  lastAttachmentType?: string; // "image" | "pdf" | "video" | "file" | ""
  /**
   * Server-side marker: the createdAt of the newest message this user has
   * read, not when they read it. Compared against `lastMessageAt` to decide
   * the unread badge, which is why it has to be the same kind of value.
   */
  lastReadAt?: string;
  /**
   * Who has read the last message.
   *
   * Server-authoritative: derived on every fetch from the per-user read markers
   * the server keeps. Live MESSAGE_READ frames update it in place so the tick
   * is immediate, but they are no longer what it rests on - a receipt that
   * arrives while this client is disconnected is simply lost, and this used to
   * be tracked from those frames alone, so the inbox could claim "delivered,
   * not read" for a message that had been read, forever.
   */
  lastMessageReadBy?: string[];
  lastMessagePending?: boolean; // optimistic temp message still in-flight
  lastReactionPreview?: string; // e.g. "reacted ❤️ to "Tekst poruke…""
  lastReactionAt?: string;
  lastReactionUserId?: string;
  createdAt: string;
}

/**
 * `online` is derived server-side from whether the user still has an open
 * connection, so it is never stale in the "forgot to clear it" sense.
 * `lastSeenAt` is absent for someone who has never been online.
 */
export interface UserPresence {
  online: boolean;
  lastSeenAt?: string;
}

export type PresenceMap = Record<string, UserPresence>;

/**
 * Why the server will never accept a message, as opposed to not having accepted
 * it yet. The outbox retries silently through every transient failure; these
 * two are the cases where retrying forever would be the wrong answer.
 */
export type MessageRejection =
  /** The message itself is unusable - no conversation, no text, no attachments. */
  | "invalid"
  /** The connection it arrived on cannot be tied to a user. */
  | "unauthorized"
  /**
   * The conversation, or the already-accepted message, is no longer there -
   * a send that raced a conversation being deleted.
   */
  | "gone";

export type WsIncomingEvent =
  /**
   * The answer to a liveness probe. It carries nothing - the fact that it
   * arrived at all is the entire message.
   */
  | { type: "PONG" }
  | { type: "NEW_MESSAGE"; message: ChatMessage }
  /**
   * Our own message came back confirmed. This is the only proof the client has
   * that a send landed: the fan-out deliberately skips the sender, and the
   * Lambda's HTTP status goes to API Gateway, not down the socket. Until it
   * arrives the message stays in the outbox.
   */
  | { type: "MESSAGE_ACK"; clientMsgId: string; message: ChatMessage }
  | { type: "MESSAGE_REJECTED"; clientMsgId: string; reason: MessageRejection }
  /**
   * `readUpTo` is the createdAt of the newest message covered by the receipt.
   * Without it a receipt for old history is indistinguishable from one for the
   * message we are actually waiting on.
   */
  | { type: "MESSAGE_READ"; conversationId: string; readerId: string; messageIds: string[]; readUpTo?: string; readAt: string }
  | { type: "REACTION_UPDATE"; conversationId: string; messageId: string; reactorId: string; emoji: string; messageText: string; reactions: ReactionMap }
  | { type: "TYPING"; conversationId: string; userId: string; isTyping: boolean }
  | { type: "CONVERSATION_DELETED"; conversationId: string };