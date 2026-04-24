"use client";

import { useQuery } from "@tanstack/react-query";

interface ChatTokenData {
  token: string;
  userId: string;
}

async function fetchChatToken(): Promise<ChatTokenData> {
  const res = await fetch("/api/chat/token", { method: "POST" });
  if (!res.ok) throw new Error("Failed to fetch chat token");
  return res.json() as Promise<ChatTokenData>;
}

export function useChatToken() {
  return useQuery({
    queryKey: ["chat-token"],
    queryFn: fetchChatToken,
    // Token is valid for 2h — refetch after 110 minutes to stay ahead of expiry
    staleTime: 1000 * 60 * 110,
    gcTime: 1000 * 60 * 120,
    retry: 2,
  });
}