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
    // Token is valid for 2h — refetch after 110 minutes to stay ahead of expiry
    staleTime: 1000 * 60 * 110,
    gcTime: 1000 * 60 * 120,
    retry: 2,
  });
}