"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ReactionMap, Conversation } from "../types";

type ReactionsResponse = { reactions: Record<string, ReactionMap> };

async function fetchReactions(conversationId: string): Promise<ReactionsResponse> {
  const { data } = await axios.get<ReactionsResponse>(
    `/api/chat/conversations/${conversationId}/reactions`
  );
  return data;
}

async function postToggleReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
  messageText: string,
): Promise<{ messageId: string; reactions: ReactionMap }> {
  const { data } = await axios.post<{ messageId: string; reactions: ReactionMap }>(
    `/api/chat/conversations/${conversationId}/reactions`,
    { messageId, emoji, messageText }
  );
  return data;
}

export function useReactions(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["chat-reactions", conversationId],
    queryFn: () => fetchReactions(conversationId!),
    enabled: !!conversationId,
    staleTime: Infinity, // real-time updates come via WebSocket
  });

  const mutation = useMutation({
    mutationFn: ({
      messageId,
      emoji,
      messageText,
    }: {
      messageId: string;
      emoji: string;
      messageText: string;
      currentUserId: string;
    }) => postToggleReaction(conversationId!, messageId, emoji, messageText),

    onMutate: async ({ messageId, emoji, currentUserId }) => {
      await queryClient.cancelQueries({ queryKey: ["chat-reactions", conversationId] });
      const previous = queryClient.getQueryData<ReactionsResponse>(["chat-reactions", conversationId]);

      queryClient.setQueryData<ReactionsResponse>(
        ["chat-reactions", conversationId],
        (old) => {
          const reactions = { ...(old?.reactions ?? {}) };
          const msgReactions = { ...(reactions[messageId] ?? {}) };
          const users = msgReactions[emoji] ?? [];
          const hasReacted = users.includes(currentUserId);
          msgReactions[emoji] = hasReacted
            ? users.filter((id) => id !== currentUserId)
            : [...users, currentUserId];
          if (msgReactions[emoji].length === 0) delete msgReactions[emoji];
          reactions[messageId] = msgReactions;
          return { reactions };
        }
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["chat-reactions", conversationId], context.previous);
      }
    },

    onSuccess: (data) => {
      queryClient.setQueryData<ReactionsResponse>(
        ["chat-reactions", conversationId],
        (old) => ({
          reactions: {
            ...(old?.reactions ?? {}),
            [data.messageId]: data.reactions,
          },
        })
      );

      // If all reactions removed for this message, clear conversation preview
      if (Object.keys(data.reactions).length === 0) {
        queryClient.setQueryData<{ conversations: Conversation[] }>(
          ["chat-conversations"],
          (old) => {
            if (!old) return old;
            return {
              conversations: old.conversations.map((c) =>
                c.conversationId === conversationId
                  ? { ...c, lastReactionPreview: undefined, lastReactionAt: undefined, lastReactionUserId: undefined }
                  : c
              ),
            };
          }
        );
      }
    },
  });

  return {
    reactions: query.data?.reactions ?? {},
    toggle: (messageId: string, emoji: string, messageText: string, currentUserId: string) =>
      mutation.mutate({ messageId, emoji, messageText, currentUserId }),
  };
}