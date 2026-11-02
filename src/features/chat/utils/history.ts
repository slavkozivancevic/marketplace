import type { MessagesPage } from "../hooks/useMessages";

/**
 * The newest page fetched again on top of what is cached. History the reader
 * has already scrolled up into (useOlderMessages) is older than the newest
 * page, so a refetch must not throw it away - that would yank the reader out
 * of it. Everything older than the fresh page is kept, and with it the cursor
 * that continues behind it.
 */
export function mergeNewestPage(old: MessagesPage | undefined, fresh: MessagesPage): MessagesPage {
  if (!old || fresh.messages.length === 0 || !fresh.cursor) return fresh;
  const oldestFresh = fresh.messages[fresh.messages.length - 1].createdAt;
  const ids = new Set(fresh.messages.map((m) => m.messageId));
  const older = old.messages.filter((m) => m.createdAt < oldestFresh && !ids.has(m.messageId));
  if (older.length === 0) return fresh;
  return { messages: [...fresh.messages, ...older], cursor: old.cursor };
}

/** Older messages appended behind the cached ones (newest first), no duplicates. */
export function appendOlder(old: MessagesPage | undefined, page: MessagesPage): MessagesPage | undefined {
  if (!old) return old;
  const ids = new Set(old.messages.map((m) => m.messageId));
  return { messages: [...old.messages, ...page.messages.filter((m) => !ids.has(m.messageId))], cursor: page.cursor };
}