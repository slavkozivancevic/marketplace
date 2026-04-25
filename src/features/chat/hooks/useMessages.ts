"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ChatMessage } from "../types";

async function fetchMessages(conversationId: string): Promise<{ messages: ChatMessage[] }> {
  const { data } = await axios.get<{ messages: ChatMessage[] }>(
    `/api/chat/conversations/${conversationId}/messages`
  );
  return data;
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: () => fetchMessages(conversationId!),
    enabled: !!conversationId,
    staleTime: 1000 * 60,
  });
}