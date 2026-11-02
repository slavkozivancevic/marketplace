"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { logger } from "@/lib/logger";
import { isConversationOnScreen, useChatStore } from "../store/chatStore";
import type { Conversation } from "../types";
import { withReadState } from "../utils/messageOps";

/**
 * Opening a conversation that was marked unread clears the mark, as on
 * WhatsApp. Opening alone sends nothing when there is nothing new to read, so
 * the client says it explicitly (/conversations/read-state, read) - that is
 * the contract messaging documents in setReadState.ts. Mounted once, in the
 * chat runtime, so it covers the drawer and the page alike.
 */
export function useClearMarkOnOpen(conversations: Conversation[] | undefined): void {
  const queryClient = useQueryClient();
  const onScreenId = useChatStore((s) =>
    s.selectedConvId && isConversationOnScreen(s, s.selectedConvId) ? s.selectedConvId : null,
  );
  const marked = !!conversations?.find((c) => c.conversationId === onScreenId)?.markedUnread;
  // One request per opening, not one per re-render while it is in flight.
  const asked = useRef<string | null>(null);

  useEffect(() => {
    if (!onScreenId || !marked || asked.current === onScreenId) return;
    asked.current = onScreenId;
    const id = onScreenId;
    queryClient.setQueryData<{ conversations: Conversation[] }>(["chat-conversations"], (old) =>
      withReadState(old, [id], false),
    );
    axios.post("/api/chat/conversations/read-state", { conversationIds: [id], read: true }).catch((err) => {
      // The dot comes back with the next inbox fetch, which is the honest state.
      logger.warn("[chat] clearing the unread mark failed", err);
      void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    });
  }, [onScreenId, marked, queryClient]);

  useEffect(() => {
    if (!onScreenId) asked.current = null;
  }, [onScreenId]);
}
