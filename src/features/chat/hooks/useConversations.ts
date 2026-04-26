"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Conversation } from "../types";

async function fetchConversations(): Promise<{ conversations: Conversation[] }> {
  const { data } = await axios.get<{ conversations: Conversation[] }>("/api/chat/conversations");
  return data;
}

export function useConversations() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["chat-conversations"],
    queryFn: async () => {
      // Snapshot old cache before the fetch so we can preserve client-only fields.
      const old = queryClient.getQueryData<{ conversations: Conversation[] }>(
        ["chat-conversations"]
      );

      const data = await fetchConversations();

      // The backend doesn't return lastMessageReadBy or lastMessagePending —
      // they live only in the client cache and are maintained by WS events.
      // After a refetch we merge them back so read ticks don't reset.
      // We only carry them over when the last message hasn't changed
      // (same lastMessageAt), because a new message should reset read status.
      // Preserve lastMessagePending (client-only, short-lived) through refetches
      // so the clock icon doesn't flicker during the ~800ms send window.
      // lastMessageReadBy is now tracked in the Zustand store instead.
      if (old) {
        const oldMap = new Map(old.conversations.map((c) => [c.conversationId, c]));
        data.conversations = data.conversations.map((conv) => {
          const prev = oldMap.get(conv.conversationId);
          if (!prev || prev.lastMessageAt !== conv.lastMessageAt) return conv;
          return {
            ...conv,
            lastMessagePending: prev.lastMessagePending ?? conv.lastMessagePending,
          };
        });
      }

      return data;
    },
    staleTime: 1000 * 30,
  });
}