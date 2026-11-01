import type { ChatMessage, Conversation } from "../types";

/**
 * The same windows the messaging service enforces (editMessage.ts,
 * deleteMessage.ts) - as on WhatsApp. The server has the last word; these only
 * decide what the UI offers, so an action that is about to expire is still
 * refused cleanly if it arrives a second late.
 */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;
export const DELETE_FOR_EVERYONE_WINDOW_MS = 60 * 60 * 60 * 1000;

export interface MessageActions {
  copy: boolean;
  edit: boolean;
  deleteForEveryone: boolean;
  deleteForMe: boolean;
  react: boolean;
}

/**
 * What a selected message offers its viewer at `now`.
 *
 * - copy: any message with text that is still there;
 * - edit: own, has text, inside 15 minutes;
 * - delete for everyone: own, inside 2 days 12 hours;
 * - delete for me: always (any message, theirs too, any age) - also a deleted
 *   one, so its placeholder can be cleared away;
 * - react: anything not deleted.
 *
 * A message still in the outbox (`pending`) has no server copy to act on, so
 * it offers nothing.
 */
export function messageActions(
  message: Pick<ChatMessage, "senderId" | "text" | "createdAt" | "deletedAt">,
  me: string,
  now: number,
  pending = false,
): MessageActions {
  if (pending) return { copy: false, edit: false, deleteForEveryone: false, deleteForMe: false, react: false };
  const deleted = !!message.deletedAt;
  const own = message.senderId === me;
  const age = now - Date.parse(message.createdAt);
  const hasText = !deleted && message.text.trim().length > 0;
  return {
    copy: hasText,
    edit: own && hasText && age <= EDIT_WINDOW_MS,
    deleteForEveryone: own && !deleted && age <= DELETE_FOR_EVERYONE_WINDOW_MS,
    deleteForMe: true,
    react: !deleted,
  };
}

type MessagesData = { messages: ChatMessage[]; cursor?: string } | undefined;
type ConversationsData = { conversations: Conversation[] } | undefined;

/** The thread after an edit: new text, `editedAt` set. */
export function withEdit(data: MessagesData, messageId: string, text: string, editedAt: string): MessagesData {
  if (!data) return data;
  return {
    ...data,
    messages: data.messages.map((m) => (m.messageId === messageId ? { ...m, text, editedAt } : m)),
  };
}

/**
 * The thread after a delete. For everyone the message keeps its place as a
 * tombstone (no text, no attachments) so both sides can show where it was;
 * for me it simply leaves this viewer's thread.
 */
export function withDelete(
  data: MessagesData,
  messageId: string,
  scope: "everyone" | "me",
  deletedAt: string,
): MessagesData {
  if (!data) return data;
  if (scope === "me") return { ...data, messages: data.messages.filter((m) => m.messageId !== messageId) };
  return {
    ...data,
    messages: data.messages.map((m) =>
      m.messageId === messageId ? { ...m, text: "", attachments: [], deletedAt } : m,
    ),
  };
}

/**
 * The inbox row after the conversation's LAST message was edited or deleted
 * for everyone - matched by `lastMessageAt`, as the server does, so an older
 * message changing never touches the preview. Nothing re-sorts.
 */
export function withLastMessageChange(
  data: ConversationsData,
  conversationId: string,
  messageCreatedAt: string,
  change: { text: string } | { deleted: true },
): ConversationsData {
  if (!data) return data;
  return {
    conversations: data.conversations.map((c) => {
      if (c.conversationId !== conversationId || c.lastMessageAt !== messageCreatedAt) return c;
      return "deleted" in change
        ? { ...c, lastMessagePreview: "", lastAttachmentType: "", lastMessageDeleted: true }
        : { ...c, lastMessagePreview: change.text.slice(0, 120) };
    }),
  };
}
