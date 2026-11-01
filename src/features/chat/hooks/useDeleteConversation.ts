"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/sonner";
import { logger } from "@/lib/logger";
import { useChatStore } from "../store/chatStore";
import { useDraftStore } from "../store/draftStore";
import { useOutboxStore } from "../store/outboxStore";
import type { Conversation } from "../types";

/**
 * Deletes a conversation from this user's inbox - only theirs, as on WhatsApp;
 * the other participant keeps it, and a new message brings it back with only
 * what came after - and drops everything the client still holds for it.
 * Shared by the drawer and the page; the caller owns the dialog's `open`, so
 * a failed delete leaves it open (see ActionButton).
 */
export function useDeleteConversation() {
  const t = useTranslations("chat");
  const queryClient = useQueryClient();
  const clearDraft = useDraftStore((s) => s.clearDraft);
  const clearOutbox = useOutboxStore((s) => s.clearConversation);
  const [deleting, setDeleting] = useState(false);

  const deleteConversation = async (conversationId: string): Promise<boolean> => {
    setDeleting(true);
    try {
      await axios.delete(`/api/chat/conversations/${conversationId}`);
      queryClient.setQueryData<{ conversations: Conversation[] }>(
        ["chat-conversations"],
        (old) => old
          ? { conversations: old.conversations.filter((c) => c.conversationId !== conversationId) }
          : old
      );
      void queryClient.removeQueries({ queryKey: ["chat-messages", conversationId] });
      void queryClient.removeQueries({ queryKey: ["conversation-search"] });
      // The draft outlives the component, so it has to be dropped explicitly -
      // otherwise a half-typed message comes back in a conversation the user
      // deleted (and, with sessionStorage, survives a reload to do it).
      clearDraft(conversationId);
      // Same for anything still queued: the conversation it belonged to is
      // gone, so a retry would keep knocking at a door that no longer exists.
      clearOutbox(conversationId);
      // Deleted from the inbox list, it may not be the open one - close the
      // thread only if it is.
      const chat = useChatStore.getState();
      if (chat.selectedConvId === conversationId) chat.setSelectedConvId(null);
      return true;
    } catch (err) {
      logger.error("[deleteConversation]", err);
      toast.error(t("deleteFailed"));
      return false;
    } finally {
      setDeleting(false);
    }
  };

  return { deleteConversation, deleting };
}
