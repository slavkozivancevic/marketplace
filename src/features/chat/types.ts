export interface ChatMessage {
  messageId: string;
  conversationId: string;
  senderId: string;
  text: string;
  attachments: { key: string; type: string }[];
  readBy: string[];
  createdAt: string;
  // SK in DynamoDB — needed for markRead
  sk?: string;
}

export interface Conversation {
  conversationId: string;
  participants: string[];
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageSenderId?: string;
  createdAt: string;
}

export type WsIncomingEvent =
  | { type: "NEW_MESSAGE"; message: ChatMessage }
  | { type: "MESSAGE_READ"; conversationId: string; readerId: string; messageIds: string[]; readAt: string };