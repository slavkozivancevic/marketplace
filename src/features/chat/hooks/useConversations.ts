"use client";

import { useQuery } from "@tanstack/react-query";
import { Conversation } from "../types";

async function fetchConversations(): Promise<{ conversations: Conversation[] }> {
  const res = await fetch("/api/chat/conversations");
  if (!res.ok) throw new Error("Failed to fetch conversations");
  return res.json() as Promise<{ conversations: Conversation[] }>;
}

export function useConversations() {
  return useQuery({
    queryKey: ["chat-conversations"],
    queryFn: fetchConversations,
    staleTime: 1000 * 30,
  });
}