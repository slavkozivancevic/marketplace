"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatStore } from "../store/chatStore";
import type { Conversation } from "../types";

/**
 * The number on the header trigger and the page's inbox button: unread
 * messages, plus each conversation marked unread by hand that has none - as
 * on WhatsApp, where a "Mark as unread" chat counts as one.
 *
 * Reads the inbox straight from the query cache (the chat runtime fetches
 * it). Not through `useQuery`: an observer with no fetch of its own either
 * warns (no queryFn) or, created first, leaves the shared query holding a
 * queryFn that cannot run (skipToken) - and an account with no chat must not
 * make the request at all.
 */
export function useUnreadTotal(): number {
  const unreadCount = useChatStore((s) => s.unreadCount);
  const convUnread = useChatStore((s) => s.convUnread);
  const queryClient = useQueryClient();
  const subscribe = useCallback(
    (onChange: () => void) => queryClient.getQueryCache().subscribe(onChange),
    [queryClient],
  );
  const data = useSyncExternalStore(
    subscribe,
    () => queryClient.getQueryData<{ conversations: Conversation[] }>(["chat-conversations"]),
    () => undefined,
  );
  const marked = (data?.conversations ?? []).filter(
    (c) => c.markedUnread && !(convUnread[c.conversationId] > 0),
  ).length;
  return unreadCount + marked;
}
