"use client";
import { logger } from "@/lib/logger";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { env } from "@/env/client";
import { WsIncomingEvent, ChatMessage, Conversation } from "../types";
import { useChatStore, TYPING_HEARTBEAT_MS } from "../store/chatStore";
import { playReceiveSound } from "../utils/chatSounds";

type ReactionsResponse = { reactions: Record<string, Record<string, string[]>> };

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
  // conversationId → epoch ms of the last "start" frame we sent for it.
  // Throttles the heartbeat so a long message costs a handful of frames
  // instead of one per keystroke.
  const typingSentAtRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!token) return;

    let closed = false;

    function connect() {
      if (closed) return;
      // Don't retry with an expired token - wait for useChatToken to provide a fresh one
      if (!token || isTokenExpired(token)) return;

      const wsUrl = `${env.NEXT_PUBLIC_CHAT_WS_URL}?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        logger.info("[chat] WebSocket connected");
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
          // Ensure readBy is always an array - older Lambda versions may omit it
          const safeMsg: ChatMessage = { ...msg, readBy: msg.readBy ?? [] };

          // The message itself proves they stopped typing. Without this the
          // dots hang around behind the new bubble until the TTL expires,
          // which is the detail that makes an indicator look broken.
          useChatStore.getState().setTyping(msg.conversationId, msg.senderId, false);

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

          // Update conversations cache - add the conversation if it's new
          const { lastAttachmentType: wsAttachType, attachmentPreview: wsAttachPreview } =
            attachmentMeta(msg.attachments ?? []);
          const wsPreview = msg.text || wsAttachPreview;

          queryClient.setQueryData<{ conversations: Conversation[] }>(
            ["chat-conversations"],
            (old) => {
              if (!old) {
                // Nothing cached yet - invalidate so inbox refetches
                void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
                return old;
              }
              const exists = old.conversations.some(
                (c) => c.conversationId === msg.conversationId
              );
              if (!exists) {
                // First message in a brand-new conversation - prepend it
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
            } else {
              // Conversation is open - the thread auto-marks this message read.
              // Record it as seen so bootstrapUnread doesn't resurface a badge
              // for it on the next sign-in / reload.
              useChatStore.getState().recordSeen(msg.conversationId, msg.createdAt);
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

        if (data.type === "REACTION_UPDATE") {
          // Update reactions cache for the conversation
          queryClient.setQueryData<ReactionsResponse>(
            ["chat-reactions", data.conversationId],
            (old) => ({
              reactions: {
                ...(old?.reactions ?? {}),
                [data.messageId]: data.reactions,
              },
            })
          );

          // Update conversation list preview
          const hasReactions = Object.keys(data.reactions).length > 0;
          queryClient.setQueryData<{ conversations: Conversation[] }>(
            ["chat-conversations"],
            (old) => {
              if (!old) return old;
              if (!hasReactions) {
                // All reactions removed - revert to last message preview
                return {
                  conversations: old.conversations.map((c) =>
                    c.conversationId === data.conversationId
                      ? { ...c, lastReactionPreview: undefined, lastReactionAt: undefined, lastReactionUserId: undefined }
                      : c
                  ),
                };
              }
              const previewText = data.messageText
                ? `"${data.messageText.slice(0, 30)}${data.messageText.length > 30 ? "…" : ""}"`
                : "";
              const reactionPreview = `reacted ${data.emoji}${previewText ? ` to ${previewText}` : ""}`;
              return {
                conversations: old.conversations.map((c) =>
                  c.conversationId === data.conversationId
                    ? {
                        ...c,
                        lastReactionPreview: reactionPreview,
                        lastReactionAt: new Date().toISOString(),
                        lastReactionUserId: data.reactorId,
                      }
                    : c
                ),
              };
            }
          );

          // Play sound only if the reactor is someone else
          if (data.reactorId !== currentUserId) {
            playReceiveSound();
          }
        }

        if (data.type === "TYPING") {
          // Ephemeral by design: no cache write, no sound, no unread bump.
          // Our own echo can never reach us (the Lambda skips the sender), but
          // guard anyway so a future multi-device fan-out can't show us our
          // own dots.
          if (data.userId !== currentUserId) {
            useChatStore
              .getState()
              .setTyping(data.conversationId, data.userId, data.isTyping);
          }
        }

        if (data.type === "CONVERSATION_DELETED") {
          // Remove from conversation list cache
          queryClient.setQueryData<{ conversations: Conversation[] }>(
            ["chat-conversations"],
            (old) => {
              if (!old) return old;
              return {
                conversations: old.conversations.filter(
                  (c) => c.conversationId !== data.conversationId
                ),
              };
            }
          );
          // Invalidate message and search caches for this conversation
          void queryClient.removeQueries({ queryKey: ["chat-messages", data.conversationId] });
          void queryClient.removeQueries({ queryKey: ["conversation-search"] });
          useChatStore.getState().clearTyping(data.conversationId);
          // If the deleted conversation is open, close it
          const { selectedConvId, setSelectedConvId } = useChatStore.getState();
          if (selectedConvId === data.conversationId) {
            setSelectedConvId(null);
          }
        }
      };

      ws.onerror = (event) => {
        const e = event as ErrorEvent;
        logger.warn("[chat] WebSocket error", e.message ?? "(no message)", e.type);
      };

      ws.onclose = (event) => {
        logger.info("[chat] WebSocket closed", event.code, event.reason);
        wsRef.current = null;
        // The next burst after a reconnect must send a fresh start rather than
        // be throttled against a timestamp from the dead socket.
        typingSentAtRef.current = {};
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

    // Optimistic update - show the message immediately on sender's side
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

    // Track read status in the store - sender has read their own message
    useChatStore.getState().setReadStatus(conversationId, [currentUserId]);

    // The message clears the peer's indicator on arrival, so the composer's
    // follow-up stop has nothing left to announce - drop the throttle entry
    // and `sendTyping` will skip that frame entirely.
    delete typingSentAtRef.current[conversationId];

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

  /**
   * Tells the other participants whether we are composing.
   *
   * Cost control lives here, not on the server: a "start" goes out at most
   * once every TYPING_HEARTBEAT_MS per conversation, and a "stop" is only sent
   * if a "start" actually preceded it - so leaving an untouched thread, or
   * blurring an empty composer, costs nothing at all.
   */
  const sendTyping = (conversationId: string, isTyping: boolean) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;

    const lastSentAt = typingSentAtRef.current[conversationId];

    if (isTyping) {
      if (lastSentAt && Date.now() - lastSentAt < TYPING_HEARTBEAT_MS) return;
      typingSentAtRef.current[conversationId] = Date.now();
    } else {
      if (!lastSentAt) return;
      delete typingSentAtRef.current[conversationId];
    }

    wsRef.current.send(
      JSON.stringify({ action: "typing", conversationId, isTyping })
    );
  };

  const markRead = (conversationId: string, messageIds: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({ action: "markRead", conversationId, messageIds })
      );
    }
  };

  return { sendMessage, sendTyping, markRead };
}