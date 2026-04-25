"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Conversation } from "../types";

async function fetchConversations(): Promise<{ conversations: Conversation[] }> {
  const { data } = await axios.get<{ conversations: Conversation[] }>("/api/chat/conversations");
  return data;
}

export function useConversations() {
  return useQuery({
    queryKey: ["chat-conversations"],
    queryFn: fetchConversations,
    staleTime: 1000 * 30,
  });
}