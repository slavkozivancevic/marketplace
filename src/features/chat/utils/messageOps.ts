import type { ChatMessage, Conversation } from "../types";
import { intlLocale } from "@/lib/i18n/dateLocale";

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

export interface SelectionActions {
  reply: boolean;
  copy: boolean;
  edit: boolean;
  deleteForEveryone: boolean;
  deleteForMe: boolean;
  react: boolean;
}

/**
 * What a selection of messages offers, as on WhatsApp:
 *
 * - exactly one: what `messageActions` allows it, plus reply (anything not
 *   deleted) and the emoji bar;
 * - several: copy (when any has text) and delete only - no reply, no edit,
 *   no emoji bar. Delete for everyone only when EVERY picked message could be
 *   deleted for everyone on its own (own, not deleted, inside 60 hours) -
 *   otherwise the dialog offers delete for me alone.
 */
export function selectionActions(
  messages: Pick<ChatMessage, "senderId" | "text" | "createdAt" | "deletedAt">[],
  me: string,
  now: number,
): SelectionActions {
  const each = messages.map((m) => messageActions(m, me, now));
  if (each.length === 0) {
    return { reply: false, copy: false, edit: false, deleteForEveryone: false, deleteForMe: false, react: false };
  }
  const one = each.length === 1 ? each[0] : null;
  return {
    reply: !!one && !messages[0].deletedAt,
    copy: each.some((a) => a.copy),
    edit: !!one?.edit,
    deleteForEveryone: each.every((a) => a.deleteForEveryone),
    deleteForMe: true,
    react: !!one?.react,
  };
}

/**
 * The clipboard text for a copy, as on WhatsApp: one message is just its
 * text; several are one line each, in thread order, prefixed with when and by
 * whom - `[10:05, 2.11.2026.] Ana: tekst` - with the date and time in the
 * viewer's locale. Messages with no text (a photo, a deleted one) are left out.
 */
export function formatCopy(
  messages: Pick<ChatMessage, "senderId" | "text" | "createdAt" | "deletedAt">[],
  nameOf: (senderId: string) => string,
  locale: string,
): string {
  const withText = [...messages]
    .filter((m) => !m.deletedAt && m.text.trim())
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  if (withText.length === 1 && messages.length === 1) return withText[0].text;
  const time = new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit" });
  const date = new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "numeric", year: "numeric" });
  return withText
    .map((m) => {
      const at = new Date(m.createdAt);
      return `[${time.format(at)}, ${date.format(at)}] ${nameOf(m.senderId)}: ${m.text}`;
    })
    .join("\n");
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
 * The thread after a delete of one or more messages. For everyone a message
 * keeps its place as a tombstone (no text, no attachments, no quote of its
 * own) so both sides can show where it was, and every reply quoting it loses
 * the quoted words, as the server does (`replyTo.deleted`). For me it simply
 * leaves this viewer's thread, and a reply quoting it can no longer jump to
 * it (`replyTo.unavailable`).
 */
export function withDelete(
  data: MessagesData,
  messageIds: string | string[],
  scope: "everyone" | "me",
  deletedAt: string,
): MessagesData {
  if (!data) return data;
  const ids = new Set(Array.isArray(messageIds) ? messageIds : [messageIds]);
  const quoting = (m: ChatMessage) => !!m.replyTo && ids.has(m.replyTo.messageId);
  if (scope === "me") {
    return {
      ...data,
      messages: data.messages
        .filter((m) => !ids.has(m.messageId))
        .map((m) => (quoting(m) ? { ...m, replyTo: { ...m.replyTo!, unavailable: true } } : m)),
    };
  }
  return {
    ...data,
    messages: data.messages.map((m) => {
      if (ids.has(m.messageId)) {
        const tomb: ChatMessage = { ...m, text: "", attachments: [], deletedAt };
        delete tomb.replyTo;
        return tomb;
      }
      if (quoting(m)) {
        const { messageId, createdAt, senderId, unavailable } = m.replyTo!;
        return { ...m, replyTo: { messageId, createdAt, senderId, deleted: true, ...(unavailable ? { unavailable } : {}) } };
      }
      return m;
    }),
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

/** The inbox rows after "Mark as read" / "Mark as unread". Read moves the marker to the last message. */
export function withReadState(data: ConversationsData, conversationIds: string[], unread: boolean): ConversationsData {
  if (!data) return data;
  const ids = new Set(conversationIds);
  return {
    conversations: data.conversations.map((c) =>
      ids.has(c.conversationId) ? { ...c, markedUnread: unread, ...(unread ? {} : { lastReadAt: c.lastMessageAt }) } : c,
    ),
  };
}