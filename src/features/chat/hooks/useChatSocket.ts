"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { env } from "@/env/client";
import { WsIncomingEvent, ChatMessage, Conversation } from "../types";
import { useChatStore } from "../store/chatStore";

export function useChatSocket(token: string | undefined, currentUserId: string) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;

    let closed = false;

    function connect() {
      if (closed) return;

      const wsUrl = `${env.NEXT_PUBLIC_CHAT_WS_URL}?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[chat] WebSocket connected");
      };

      ws.onmessage = (event) => {
        let data: WsIncomingEvent;
        try {
          data = JSON.parse(event.data as string) as WsIncomingEvent;
        } catch {
          return;
        }

        if (data.type === "NEW_MESSAGE") {
          const msg = data.message;
          // Ensure readBy is always an array — older Lambda versions may omit it
          const safeMsg: ChatMessage = { ...msg, readBy: msg.readBy ?? [] };

          // Inject into messages cache
          queryClient.setQueryData<{ messages: ChatMessage[]; cursor?: string }>(
            ["chat-messages", msg.conversationId],
            (old) => ({
              messages: [safeMsg, ...(old?.messages ?? [])],
              cursor: old?.cursor,
            })
          );

          // Update conversations cache — add the conversation if it's new
          queryClient.setQueryData<{ conversations: Conversation[] }>(
            ["chat-conversations"],
            (old) => {
              if (!old) {
                // Nothing cached yet — invalidate so inbox refetches
                void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
                return old;
              }
              const exists = old.conversations.some(
                (c) => c.conversationId === msg.conversationId
              );
              if (!exists) {
                // First message in a brand-new conversation — prepend it
                const newConv: Conversation = {
                  conversationId: msg.conversationId,
                  participants: [msg.senderId, currentUserId].sort(),
                  lastMessageAt: msg.createdAt,
                  lastMessagePreview: msg.text,
                  lastMessageSenderId: msg.senderId,
                  createdAt: msg.createdAt,
                };
                return { conversations: [newConv, ...old.conversations] };
              }
              return {
                conversations: old.conversations.map((c) =>
                  c.conversationId === msg.conversationId
                    ? {
                        ...c,
                        lastMessageAt: msg.createdAt,
                        lastMessagePreview: msg.text,
                        lastMessageSenderId: msg.senderId,
                      }
                    : c
                ),
              };
            }
          );

          // Increment unread badge if the user isn't actively viewing this conversation
          if (msg.senderId !== currentUserId) {
            const { isOpen, selectedConvId } = useChatStore.getState();
            if (!(isOpen && selectedConvId === msg.conversationId)) {
              useChatStore.getState().incrementUnread(msg.conversationId);
            }
          }
        }

        if (data.type === "MESSAGE_READ") {
          queryClient.setQueryData<{ messages: ChatMessage[]; cursor?: string }>(
            ["chat-messages", data.conversationId],
            (old) => {
              if (!old) return old;
              return {
                ...old,
                messages: old.messages.map((m) =>
                  data.messageIds.includes(
                    m.sk ?? `MSG#${m.createdAt}#${m.messageId}`
                  )
                    ? { ...m, readBy: [...new Set([...m.readBy, data.readerId])] }
                    : m
                ),
              };
            }
          );
        }
      };

      ws.onerror = (event) => {
        const e = event as ErrorEvent;
        console.warn("[chat] WebSocket error", e.message ?? "(no message)", e.type);
      };

      ws.onclose = (event) => {
        console.log("[chat] WebSocket closed", event.code, event.reason);
        wsRef.current = null;
        if (!closed && event.code !== 1000) {
          setTimeout(connect, 3000);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      wsRef.current?.close(1000, "unmount");
      wsRef.current = null;
    };
  }, [token, currentUserId, queryClient]);

  const sendMessage = (conversationId: string, text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Optimistic update — show the message immediately on sender's side
    const tempMsg: ChatMessage = {
      messageId: `temp-${Date.now()}`,
      conversationId,
      senderId: currentUserId,
      text,
      attachments: [],
      readBy: [currentUserId],
      createdAt: new Date().toISOString(),
    };

    queryClient.setQueryData<{ messages: ChatMessage[]; cursor?: string }>(
      ["chat-messages", conversationId],
      (old) => ({
        messages: [tempMsg, ...(old?.messages ?? [])],
        cursor: old?.cursor,
      })
    );

    queryClient.setQueryData<{ conversations: Conversation[] }>(
      ["chat-conversations"],
      (old) => {
        if (!old) return old;
        return {
          conversations: old.conversations.map((c) =>
            c.conversationId === conversationId
              ? {
                  ...c,
                  lastMessageAt: tempMsg.createdAt,
                  lastMessagePreview: text,
                  lastMessageSenderId: currentUserId,
                }
              : c
          ),
        };
      }
    );

    wsRef.current.send(
      JSON.stringify({ action: "sendMessage", conversationId, text })
    );

    // Replace the temp message with the real persisted record so that
    // incoming MESSAGE_READ events can match the correct DynamoDB SK.
    setTimeout(() => {
      void queryClient.invalidateQueries({
        queryKey: ["chat-messages", conversationId],
      });
    }, 800);
  };

  const markRead = (conversationId: string, messageIds: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ action: "markRead", conversationId, messageIds })
      );
    }
  };

  return { sendMessage, markRead };
}