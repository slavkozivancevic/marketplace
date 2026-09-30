"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { PresenceMap } from "../types";

/** Shared so useChatSocket can write into the same cache entry. */
export function presenceQueryKey(conversationId: string) {
  return ["chat-presence", conversationId] as const;
}

async function fetchPresence(conversationId: string): Promise<{ presence: PresenceMap }> {
  const { data } = await axios.get<{ presence: PresenceMap }>(
    `/api/chat/conversations/${conversationId}/presence`
  );
  return data;
}

/**
 * Presence of the other participants in one conversation.
 *
 * Polled rather than pushed, and that is the cheap choice here: a push would
 * mean fanning out on every connect and disconnect to everyone the user has
 * ever talked to, which scales with the size of their inbox. This runs only
 * while a conversation is actually open, and stops when the tab goes to the
 * background.
 *
 * The interval is also mostly a fallback - useChatSocket marks the peer online
 * the moment any event arrives from them, so in an active conversation the
 * poll rarely finds anything it did not already know.
 *
 * Not org-scoped: presence belongs to a person, not to the organization the
 * viewer happens to be acting as, so the key carries no orgId.
 */
export function usePresence(conversationId: string | null) {
  return useQuery({
    queryKey: presenceQueryKey(conversationId ?? ""),
    queryFn: () => fetchPresence(conversationId!),
    enabled: !!conversationId,
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}
