"use client";

import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatStore } from "../store/chatStore";
import { useConversations } from "./useConversations";
import { useMessages } from "./useMessages";
import { usePresence } from "./usePresence";
import { useUserProfiles } from "./useUserProfiles";

/**
 * Everything a chat surface reads to draw the inbox and the open thread.
 * Shared by the drawer and the `/messages` page, so the two cannot drift on
 * what "the other participant" or "typing here" means.
 */
export function useChatThreadData(selectedConvId: string | null, currentUserId: string) {
  const queryClient = useQueryClient();
  const typing = useChatStore((s) => s.typing);

  const { data: convsData, isLoading: convsLoading, isFetching: convsFetching } = useConversations();
  const { data: msgsData, isLoading: msgsLoading } = useMessages(selectedConvId);

  const conversations = useMemo(() => convsData?.conversations ?? [], [convsData?.conversations]);
  // Memoised like `conversations` above: a fresh `[]` on every render would
  // churn the thread's own memo.
  const messages = useMemo(() => msgsData?.messages ?? [], [msgsData?.messages]);

  // Collect every participant ID so we can resolve names
  const allParticipantIds = [...new Set(conversations.flatMap((c) => c.participants))];
  const { data: profiles = {}, isLoading: profilesLoading } = useUserProfiles(allParticipantIds);

  const selectedConv = conversations.find((c) => c.conversationId === selectedConvId);
  const otherParticipantId =
    selectedConv?.participants.find((p) => p !== currentUserId) ?? "";
  const otherParticipantName = profiles[otherParticipantId]?.name ?? "";

  // When opened to a specific conversation, ensure inbox is fresh
  useEffect(() => {
    if (selectedConvId) {
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    }
  }, [selectedConvId, queryClient]);

  const typingInSelected = useMemo(
    () => Object.keys(typing[selectedConvId ?? ""] ?? {}),
    [typing, selectedConvId]
  );

  // Only runs while a conversation is open - see usePresence.
  const { data: presenceData, isLoading: presenceLoading } = usePresence(selectedConvId);

  return {
    conversations,
    convsLoading,
    convsFetching,
    convsLoaded: !!convsData,
    messages,
    msgsLoading,
    profiles,
    profilesLoading,
    selectedConv,
    otherParticipantId,
    otherParticipantName,
    typingInSelected,
    presence: presenceData?.presence[otherParticipantId],
    presenceLoading: presenceLoading && !presenceData,
  };
}
