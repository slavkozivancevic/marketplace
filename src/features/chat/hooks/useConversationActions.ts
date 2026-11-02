"use client";

import { useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/sonner";
import { logger } from "@/lib/logger";
import { useChatStore } from "../store/chatStore";
import { useDraftStore } from "../store/draftStore";
import { useOutboxStore } from "../store/outboxStore";
import type { Conversation } from "../types";
import { withReadState } from "../utils/messageOps";

type ConversationsData = { conversations: Conversation[] } | undefined;

/**
 * Drops conversations deleted "for me" from everything the client holds:
 * the inbox row, the cached thread, the draft (it outlives the component, and
 * with sessionStorage a reload), anything still queued (a retry would keep
 * knocking at a door that no longer exists), and the open thread if it is one
 * of them. Shared by our own delete and the socket's CONVERSATIONS_DELETED.
 */
export function forgetConversations(queryClient: QueryClient, conversationIds: string[]): void {
  const gone = new Set(conversationIds);
  queryClient.setQueryData<ConversationsData>(["chat-conversations"], (old) =>
    old ? { conversations: old.conversations.filter((c) => !gone.has(c.conversationId)) } : old,
  );
  for (const id of conversationIds) {
    void queryClient.removeQueries({ queryKey: ["chat-messages", id] });
    useDraftStore.getState().clearDraft(id);
    useOutboxStore.getState().clearConversation(id);
    useChatStore.getState().clearTyping(id);
  }
  void queryClient.removeQueries({ queryKey: ["conversation-search"] });
  const chat = useChatStore.getState();
  if (chat.selectedConvId && gone.has(chat.selectedConvId)) chat.setSelectedConvId(null);
}


/**
 * The inbox multi-select actions, as on WhatsApp, shared by the drawer and the
 * page:
 *
 * - delete: removes the conversations from this user's inbox only (the other
 *   participant keeps them, a new message brings one back with only what came
 *   after), all or nothing;
 * - mark as read: the same as opening them - blue ticks for the other side;
 * - mark as unread: a dot on the row until it is opened.
 *
 * The caller owns the dialog's `open`, so a failed delete leaves it open
 * beside the toast (see ActionButton). `pending` says which action runs.
 */
export function useConversationActions() {
  const t = useTranslations("chat");
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<"delete" | "read" | "unread" | null>(null);

  const deleteConversations = async (conversationIds: string[]): Promise<boolean> => {
    setPending("delete");
    try {
      await axios.post("/api/chat/conversations/delete", { conversationIds });
      forgetConversations(queryClient, conversationIds);
      return true;
    } catch (err) {
      logger.error("[deleteConversations]", err);
      toast.error(t("deleteFailed"));
      return false;
    } finally {
      setPending(null);
    }
  };

  const setReadState = async (conversationIds: string[], read: boolean): Promise<boolean> => {
    setPending(read ? "read" : "unread");
    try {
      await axios.post("/api/chat/conversations/read-state", { conversationIds, read });
      queryClient.setQueryData<ConversationsData>(["chat-conversations"], (old) =>
        withReadState(old, conversationIds, !read),
      );
      if (read) for (const id of conversationIds) useChatStore.getState().clearUnread(id);
      return true;
    } catch (err) {
      logger.error("[setReadState]", err);
      toast.error(t("readStateFailed"));
      return false;
    } finally {
      setPending(null);
    }
  };

  return { deleteConversations, setReadState, pending };
}
