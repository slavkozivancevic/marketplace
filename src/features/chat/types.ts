export interface ChatMessage {
  messageId: string;
  conversationId: string;
  senderId: string;
  text: string;
  attachments: { key: string; type: string; width?: number; height?: number; filename?: string; size?: number }[];
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
  lastAttachmentType?: string; // "image" | "pdf" | "video" | "file" | ""
  lastMessageReadBy?: string[]; // who has read the last message (client-tracked)
  lastMessagePending?: boolean; // optimistic temp message still in-flight
  createdAt: string;
}

export type WsIncomingEvent =
  | { type: "NEW_MESSAGE"; message: ChatMessage }
  | { type: "MESSAGE_READ"; conversationId: string; readerId: string; messageIds: string[]; readAt: string };