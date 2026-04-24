"use client";

import { useQuery } from "@tanstack/react-query";
import { ChatMessage } from "../types";

async function fetchMessages(conversationId: string): Promise<{ messages: ChatMessage[] }> {
  const res = await fetch(`/api/chat/conversations/${conversationId}/messages`);
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json() as Promise<{ messages: ChatMessage[] }>;
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: () => fetchMessages(conversationId!),
    enabled: !!conversationId,
    staleTime: 1000 * 60,
  });
}