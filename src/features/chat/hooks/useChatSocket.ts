"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { env } from "@/env/client";
import { WsIncomingEvent, ChatMessage, Conversation } from "../types";
import { useChatStore } from "../store/chatStore";
import { playReceiveSound } from "../utils/chatSounds";

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as { exp: number };
    return Date.now() >= payload.exp * 1000;
  } catch {
    return false;
  }
}

/** Derive lastAttachmentType and a human-readable preview from an attachments array. */
function attachmentMeta(attachments: { type: string; filename?: string }[]): {
  lastAttachmentType: string;
  attachmentPreview: string;
} {
  if (!attachments.length) return { lastAttachmentType: "", attachmentPreview: "" };
  const { type, filename } = attachments[0];
  if (type.startsWith("image/")) return { lastAttachmentType: "image", attachmentPreview: "Photo" };
  if (type === "application/pdf") return { lastAttachmentType: "pdf", attachmentPreview: filename ? `PDF · ${filename}` : "PDF" };
  if (type.startsWith("video/")) return { lastAttachmentType: "video", attachmentPreview: filename ? `Video · ${filename}` : "Video" };
  return { lastAttachmentType: "file", attachmentPreview: filename ?? "File" };
}

export function useChatSocket(token: string | undefined, currentUserId: string) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;

    let closed = false;

    function connect() {
      if (closed) return;
      // Don't retry with an expired token — wait for useChatToken to provide a fresh one
      if (!token || isTokenExpired(token)) return;

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

          // Inject into messages cache only if the conversation is already cached.
          // If it isn't, leave the cache empty so useMessages fetches the full
          // history when the user opens the conversation.
          queryClient.setQueryData<{ messages: ChatMessage[]; cursor?: string }>(
            ["chat-messages", msg.conversationId],
            (old) => {
              if (!old) return old;
              return {
                messages: [safeMsg, ...old.messages],
                cursor: old.cursor,
              };
            }
          );

          // Update conversations cache — add the conversation if it's new
          const { lastAttachmentType: wsAttachType, attachmentPreview: wsAttachPreview } =
            attachmentMeta(msg.attachments ?? []);
          const wsPreview = msg.text || wsAttachPreview;

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
                  lastMessagePreview: wsPreview,
                  lastMessageSenderId: msg.senderId,
                  lastAttachmentType: wsAttachType,
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
                        lastMessagePreview: wsPreview,
                        lastMessageSenderId: msg.senderId,
                        lastAttachmentType: wsAttachType,
                        lastMessagePending: false,
                        lastMessageReadBy: msg.senderId === currentUserId
                          ? (c.lastMessageReadBy ?? [currentUserId])
                          : msg.readBy ?? [],
                      }
                    : c
                ),
              };
            }
          );

          // Track read status in the store so it survives React Query refetches
          useChatStore.getState().setReadStatus(msg.conversationId, msg.readBy ?? []);

          // Increment unread badge and play sound if the message is from someone else
          if (msg.senderId !== currentUserId) {
            const { isOpen, selectedConvId } = useChatStore.getState();
            if (!(isOpen && selectedConvId === msg.conversationId)) {
              useChatStore.getState().incrementUnread(msg.conversationId);
            }
            playReceiveSound();
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
          // Update read status in the Zustand store so it survives React Query refetches
          const prev = useChatStore.getState().readStatus[data.conversationId] ?? [];
          useChatStore.getState().setReadStatus(
            data.conversationId,
            [...new Set([...prev, data.readerId])]
          );
          // Clear pending flag in the conversations cache
          queryClient.setQueryData<{ conversations: Conversation[] }>(
            ["chat-conversations"],
            (old) => {
              if (!old) return old;
              return {
                conversations: old.conversations.map((c) =>
                  c.conversationId === data.conversationId
                    ? { ...c, lastMessagePending: false }
                    : c
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

  const sendMessage = (
    conversationId: string,
    text: string,
    attachments: { key: string; type: string; width?: number; height?: number; filename?: string; size?: number }[] = []
  ) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Optimistic update — show the message immediately on sender's side
    const tempMsg: ChatMessage = {
      messageId: `temp-${Date.now()}`,
      conversationId,
      senderId: currentUserId,
      text,
      attachments,
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

    const { lastAttachmentType: sendAttachType, attachmentPreview: sendAttachPreview } =
      attachmentMeta(attachments);
    const sendPreview = text || sendAttachPreview;

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
                  lastMessagePreview: sendPreview,
                  lastMessageSenderId: currentUserId,
                  lastAttachmentType: sendAttachType,
                  lastMessagePending: true,
                  lastMessageReadBy: [currentUserId],
                }
              : c
          ),
        };
      }
    );

    // Track read status in the store — sender has read their own message
    useChatStore.getState().setReadStatus(conversationId, [currentUserId]);

    wsRef.current.send(
      JSON.stringify({ action: "sendMessage", conversationId, text, attachments })
    );

    // Replace the temp message with the real persisted record so that
    // incoming MESSAGE_READ events can match the correct DynamoDB SK.
    // Also clear the pending flag on the conversation so the clock disappears.
    setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      queryClient.setQueryData<{ conversations: Conversation[] }>(
        ["chat-conversations"],
        (old) => {
          if (!old) return old;
          return {
            conversations: old.conversations.map((c) =>
              c.conversationId === conversationId
                ? { ...c, lastMessagePending: false }
                : c
            ),
          };
        }
      );
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