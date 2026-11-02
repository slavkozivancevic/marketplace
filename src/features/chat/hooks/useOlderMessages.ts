"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { fetchMessages, useMessages, type MessagesPage } from "./useMessages";
import { appendOlder } from "../utils/history";

/**
 * History behind what the thread has loaded, as on WhatsApp:
 *
 * - `loadOlder()` - the next page, when the reader scrolls to the top;
 * - `loadUntil(createdAt)` - everything back to one message in one request
 *   (the server's `from` range), for a tap on a quote of a message older than
 *   anything on screen. Resolves to whether that message is now loaded.
 *
 * Both write into the same `["chat-messages", id]` cache the thread reads, so
 * the history stays one continuous list. `hasMore` is the server's cursor.
 */
export function useOlderMessages(conversationId: string | null) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const cursor = useMessages(conversationId).data?.cursor;

  const run = useCallback(
    async (from?: string): Promise<boolean> => {
      if (!conversationId || busy.current) return false;
      const current = queryClient.getQueryData<MessagesPage>(["chat-messages", conversationId]);
      if (!current?.cursor) return false;
      busy.current = true;
      setLoading(true);
      try {
        let next: string | undefined = current.cursor;
        // A `from` range stops at 500; go on until the target is in or history ends.
        do {
          const page = await fetchMessages(conversationId, { cursor: next, from });
          queryClient.setQueryData<MessagesPage>(["chat-messages", conversationId], (old) => appendOlder(old, page));
          next = page.cursor;
        } while (from && next && !reached(from));
        return true;
      } catch (err) {
        logger.warn("[chat] older messages failed", err);
        return false;
      } finally {
        busy.current = false;
        setLoading(false);
      }

      function reached(at: string) {
        const msgs = queryClient.getQueryData<MessagesPage>(["chat-messages", conversationId])?.messages ?? [];
        return msgs.length > 0 && msgs[msgs.length - 1].createdAt <= at;
      }
    },
    [conversationId, queryClient],
  );

  const loadOlder = useCallback(() => run(), [run]);
  const loadUntil = useCallback(
    async (createdAt: string, messageId: string): Promise<boolean> => {
      const has = () =>
        !!queryClient
          .getQueryData<MessagesPage>(["chat-messages", conversationId])
          ?.messages.some((m) => m.messageId === messageId);
      if (has()) return true;
      await run(createdAt);
      return has();
    },
    [run, conversationId, queryClient],
  );

  return { loadOlder, loadUntil, loading, hasMore: !!cursor };
}
