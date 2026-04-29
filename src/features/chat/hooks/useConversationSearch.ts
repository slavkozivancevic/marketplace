"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface SearchResult {
  conversationId: string;
  otherUserId: string;
  otherUserNameDisplay: string;
}

async function fetchSearch(q: string): Promise<{ results: SearchResult[] }> {
  const { data } = await axios.get<{ results: SearchResult[] }>(
    "/api/chat/conversations/search",
    { params: { q } }
  );
  return data;
}

export function useConversationSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["conversation-search", q],
    queryFn: () => fetchSearch(q),
    enabled: q.length > 0,
    staleTime: 1000 * 60,
    placeholderData: (prev) => prev,
  });
}