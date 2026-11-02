"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ChatMessage } from "../types";
import { mergeNewestPage } from "../utils/history";

export type MessagesPage = { messages: ChatMessage[]; cursor?: string };

export async function fetchMessages(
  conversationId: string,
  params: { cursor?: string; from?: string } = {},
): Promise<MessagesPage> {
  const query = new URLSearchParams();
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.from) query.set("from", params.from);
  const { data } = await axios.get<MessagesPage>(
    `/api/chat/conversations/${conversationId}/messages${query.size ? `?${query}` : ""}`
  );
  return data;
}

/**
 * The open thread's messages, newest first. A refetch keeps the history the
 * reader already scrolled up into (see mergeNewestPage).
 */
export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: async () =>
      mergeNewestPage(
        queryClient.getQueryData<MessagesPage>(["chat-messages", conversationId]),
        await fetchMessages(conversationId!),
      ),
    enabled: !!conversationId,
    staleTime: 1000 * 60,
  });
}
