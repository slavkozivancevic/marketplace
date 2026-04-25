"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface ChatTokenData {
  token: string;
  userId: string;
}

async function fetchChatToken(): Promise<ChatTokenData> {
  const { data } = await axios.post<ChatTokenData>("/api/chat/token");
  return data;
}

export function useChatToken() {
  return useQuery({
    queryKey: ["chat-token"],
    queryFn: fetchChatToken,
    // Token is valid for 2h — proactively refresh every 100 minutes so the
    // socket never tries to reconnect with an expired token.
    staleTime: 1000 * 60 * 100,
    gcTime: 1000 * 60 * 120,
    refetchInterval: 1000 * 60 * 100,
    retry: 2,
  });
}