"use client";
import { logger } from "@/lib/logger";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { env } from "@/env/client";
import { WsIncomingEvent, ChatMessage, ChatAttachment, Conversation, PresenceMap } from "../types";
import { isConversationOnScreen, useChatStore, TYPING_HEARTBEAT_MS } from "../store/chatStore";
import { useOutboxStore } from "../store/outboxStore";
import {
  backoffDelay,
  dueEntries,
  hasExpired,
  hasStalled,
  CONNECTION_DEAD_MS,
  HEARTBEAT_IDLE_MS,
  MAX_ATTEMPTS,
} from "../utils/outbox";
import { presenceQueryKey } from "./usePresence";
import { playReceiveSound, playSendSound } from "../utils/chatSounds";

type ReactionsResponse = { reactions: Record<string, Record<string, string[]>> };

/**
 * Silences a socket we are done with.
 *
 * Detaching before closing is the point: `close()` produces an `onclose`, and
 * a handler still attached to an abandoned socket would act on behalf of the
 * one that replaced it.
 */
function detachSocket(ws: WebSocket | null): void {
  if (!ws) return;
  ws.onopen = null;
  ws.onmessage = null;
  ws.onerror = null;
  ws.onclose = null;
  try {
    ws.close(1000, "replaced");
  } catch {
    // Already closing or closed; nothing left to do.
  }
}

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

  /**
   * Message ids already handled, so a redelivery is a no-op.
   *
   * A set rather than a check against the query cache, because the cache is
   * not authoritative here: a conversation the user has never opened is not
   * cached at all, and that is exactly the case where the only effect of a
   * duplicate would be an unread count silently counted twice.
   */
  const seenMessagesRef = useRef(new Set<string>());
  const seenOrderRef = useRef<string[]>([]);

  /** Epoch ms of the last frame of any kind to arrive - the only proof of life. */
  const lastInboundRef = useRef(0);

  /** Whether a socket has opened before, which makes the next one a reconnect. */
  const hasConnectedRef = useRef(false);

  /**
   * The live connection routine, published by the socket effect.
   *
   * It lets `declareDead` start a fresh connection without being inside that
   * effect, and nulling it on unmount is what stops a reconnect from outliving
   * the component.
   */
  const reconnectRef = useRef<(() => void) | null>(null);

  /**
   * Gives up on a socket that still claims to be open.
   *
   * Closing it is the point: `onclose` is what clears the connected flag and
   * starts the reconnect loop, and on a socket whose network has vanished that
   * event never comes by itself. Without this the client sits on a dead
   * connection indefinitely - no messages in, none out, and nothing on screen
   * to suggest anything is wrong.
   */
  const declareDead = useCallback((reason: string) => {
    const ws = wsRef.current;
    if (!ws) return;
    logger.warn("[chat] connection looks dead, reconnecting", reason);

    // Everything here is done without waiting for `onclose`. On a socket whose
    // network has gone, `close()` wants a closing handshake that will never
    // come, so the event can be slow or never arrive - and that event is what
    // normally clears the flag and reconnects. Hanging the recovery on it would
    // mean the dead connection outlives the thing meant to replace it.
    wsRef.current = null;
    useChatStore.getState().setConnected(false);
    // What `onclose` would have done, and it is not coming - the socket is
    // detached below. Without it the first typing burst on the new socket was
    // throttled against a timestamp from the dead one, so the peer saw no
    // "typing..." for up to a heartbeat.
    typingSentAtRef.current = {};
    // Detached first, so a late event from the abandoned socket cannot reach in
    // and act on behalf of its replacement.
    detachSocket(ws);

    reconnectRef.current?.();
  }, []);

  /** Records an id, forgetting the oldest once the window is full. */
  const rememberSeen = useCallback((messageId: string) => {
    seenMessagesRef.current.add(messageId);
    seenOrderRef.current.push(messageId);
    // Bounded: this guards against redelivery, which happens within seconds,
    // so there is no reason to carry a session's whole history.
    if (seenOrderRef.current.length > 500) {
      const oldest = seenOrderRef.current.shift();
      if (oldest) seenMessagesRef.current.delete(oldest);
    }
  }, []);

  /**
   * Moves the outbox along: retires what can no longer be sent, then hands the
   * due messages to the socket.
   *
   * Stable (it reads everything through refs and `getState`), so it can sit in
   * dependency lists without churning the connection.
   *
   * The reaping half runs with or without a socket, because an attachment
   * expiring is a fact about the clock, not about the connection. The sending
   * half obviously needs one, and simply does nothing without it - which is the
   * whole point: being offline parks the queue instead of destroying it, and
   * costs the message neither an attempt nor its place in line.
   */
  const drain = useCallback(() => {
    const now = Date.now();
    const store = useOutboxStore.getState();

    for (const entry of store.entries) {
      if (entry.status === "failed" || entry.status === "delivered") continue;
      if (hasExpired(entry, now)) {
        store.markFailed(entry.clientMsgId, "expired");
      } else if (hasStalled(entry, now)) {
        // The attempt went out and nothing came back. Retrying is safe: the
        // server deduplicates on clientMsgId, so the worst case is a second
        // frame that answers with the same ack.
        if (entry.attempts >= MAX_ATTEMPTS) {
          store.markFailed(entry.clientMsgId, "retries");
        } else {
          store.markQueued(entry.clientMsgId, now + backoffDelay(entry.attempts));
        }
        // A message that went out and drew no answer is itself the evidence
        // that this socket no longer carries traffic. Reconnecting here is
        // faster than waiting for the heartbeat, and it is the difference
        // between a retry that can work and five that cannot.
        declareDead("no ack");
      }
    }

    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return;

    for (const entry of dueEntries(useOutboxStore.getState().entries, now)) {
      if (entry.attempts >= MAX_ATTEMPTS) {
        store.markFailed(entry.clientMsgId, "retries");
        continue;
      }
      // Marked before the write: if `send` throws we want the attempt counted,
      // not retried in a tight loop.
      store.markSending(entry.clientMsgId, now);
      try {
        ws.send(
          JSON.stringify({
            action: "sendMessage",
            conversationId: entry.conversationId,
            text: entry.text,
            attachments: entry.attachments,
            clientMsgId: entry.clientMsgId,
          }),
        );
      } catch (err) {
        logger.warn("[chat] outbox send failed", err);
        store.markQueued(
          entry.clientMsgId,
          now + backoffDelay(entry.attempts + 1),
        );
      }
    }
  }, [declareDead]);

  // The outbox is persisted per browser, not per account: make it this user's
  // queue before anything below can drain it. First effect on purpose - effects
  // run in declaration order, and the socket that drains it comes later.
  useEffect(() => {
    useOutboxStore.getState().bindOwner(currentUserId);
  }, [currentUserId]);

  /**
   * Watches for silence, and probes rather than assuming.
   *
   * The probe only goes out after a stretch with nothing arriving, so an active
   * conversation never sends one - its own traffic is already the proof. If the
   * silence outlasts a probe's round trip, the socket is not coming back and we
   * stop pretending it is.
   */
  useEffect(() => {
    const timer = setInterval(() => {
      const ws = wsRef.current;
      if (ws?.readyState !== WebSocket.OPEN) return;

      const silence = Date.now() - lastInboundRef.current;
      if (silence > CONNECTION_DEAD_MS) {
        declareDead("no traffic");
        return;
      }
      if (silence > HEARTBEAT_IDLE_MS) {
        try {
          ws.send(JSON.stringify({ action: "ping" }));
        } catch {
          // Nothing to do here - the silence keeps growing and the branch
          // above draws the conclusion.
        }
      }
    }, 5_000);
    return () => clearInterval(timer);
  }, [declareDead]);

  // Backoff and the ack timeout are both measured in time rather than events,
  // so they need a clock - but only while something is actually waiting.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const sync = (count: number) => {
      if (count > 0 && !timer) timer = setInterval(drain, 1000);
      else if (count === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    sync(useOutboxStore.getState().entries.length);
    const unsubscribe = useOutboxStore.subscribe((s) => sync(s.entries.length));
    return () => {
      unsubscribe();
      if (timer) clearInterval(timer);
    };
  }, [drain]);

  // The browser telling us the network is back is usually the earliest signal
  // we get - ahead of the socket noticing it is dead and reconnecting.
  useEffect(() => {
    window.addEventListener("online", drain);
    return () => window.removeEventListener("online", drain);
  }, [drain]);

  useEffect(() => {
    if (!token) return;

    let closed = false;

    /**
     * Anything arriving from someone proves they are connected right now, so
     * we can mark them online without spending a request on it. Only touches
     * an entry that already exists - if presence was never fetched for this
     * conversation, nobody is looking at it.
     */
    function markOnline(conversationId: string, userId: string) {
      queryClient.setQueryData<{ presence: PresenceMap }>(
        presenceQueryKey(conversationId),
        (old) => {
          if (!old || old.presence[userId]?.online) return old;
          return {
            presence: { ...old.presence, [userId]: { online: true } },
          };
        }
      );
    }

    function connect() {
      if (closed) return;
      // Don't retry with an expired token - wait for useChatToken to provide a fresh one
      if (!token || isTokenExpired(token)) return;

      // Only ever one socket. A reconnect scheduled while an earlier attempt
      // was still connecting would otherwise leave that one open, unreferenced
      // and still talking.
      detachSocket(wsRef.current);
      wsRef.current = null;

      const wsUrl = `${env.NEXT_PUBLIC_CHAT_WS_URL}?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      /**
       * Whether this socket is still the one in charge.
       *
       * Every handler below asks first, because a socket does not know it has
       * been replaced. Its events keep arriving - `onclose` in particular can
       * land long after the connection was abandoned - and acting on them
       * means one socket writing over the state of its own successor.
       *
       * That is not hypothetical: an abandoned socket's `onclose` cleared
       * `wsRef` after a new connection had already been stored in it. The new
       * socket then opened and set the connected flag, but nothing put it back
       * in the ref. The app looked online and the outbox, which goes by the
       * ref, saw no socket at all - so queued messages sat there for as long as
       * the page stayed open.
       */
      const isCurrent = () => wsRef.current === ws;

      ws.onopen = () => {
        if (!isCurrent()) return;
        logger.info("[chat] WebSocket connected");
        // A completed handshake is itself proof of life, and starts the clock
        // the heartbeat measures.
        lastInboundRef.current = Date.now();
        useChatStore.getState().setConnected(true);
        // Anything queued while we were down goes now, without the user having
        // to touch it.
        drain();

        // And anything that happened while we were down is fetched, because
        // nothing replays it. Delivery is a live push to whatever connections
        // exist at that instant: a message sent to us while this socket was
        // gone was handed to nobody and is simply not coming. Until this, the
        // only way to see it was to leave the conversation and come back,
        // which is a refetch the user had to think of.
        //
        // Only on a RECONNECT. On the first one these queries have just loaded,
        // and invalidating them would buy a second round trip per page load.
        if (hasConnectedRef.current) {
          logger.info("[chat] reconnected, catching up");
          void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
          const { selectedConvId } = useChatStore.getState();
          if (selectedConvId) {
            void queryClient.invalidateQueries({
              queryKey: ["chat-messages", selectedConvId],
            });
          }
        }
        hasConnectedRef.current = true;
      };

      ws.onmessage = (event) => {
        if (!isCurrent()) return;
        // Before parsing, and whatever it turns out to be: any frame at all
        // proves the socket is still carrying traffic, which is the one thing
        // the heartbeat needs to know.
        lastInboundRef.current = Date.now();

        let data: WsIncomingEvent;
        try {
          data = JSON.parse(event.data as string) as WsIncomingEvent;
        } catch {
          return;
        }

        // A PONG has served its entire purpose above.
        if (data.type === "PONG") return;

        if (data.type === "NEW_MESSAGE") {
          const msg = data.message;

          // Delivery is at-least-once, so the same message can arrive twice:
          // the server re-publishes one whose sender retried after a crash, and
          // a reconnect can overlap a push already in flight.
          //
          // The check has to come before everything else, not just before the
          // cache write. Prepending twice is the visible half; the unread count
          // and the arrival sound below are the half that cannot be undone by a
          // later refetch.
          // The seen-set remembers this session; the thread remembers across
          // reloads. Both are needed: the server republishes a message whose
          // sender retried, and that can land either side of a refresh.
          const inThread = queryClient
            .getQueryData<{ messages: ChatMessage[] }>([
              "chat-messages",
              msg.conversationId,
            ])
            ?.messages.some((m) => m.messageId === msg.messageId);

          if (seenMessagesRef.current.has(msg.messageId) || inThread) {
            logger.info("[chat] duplicate message ignored", msg.messageId);
            return;
          }
          rememberSeen(msg.messageId);

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

          // Increment unread badge and play sound if the message is from someone else
          if (msg.senderId !== currentUserId) {
            markOnline(msg.conversationId, msg.senderId);
            if (!isConversationOnScreen(useChatStore.getState(), msg.conversationId)) {
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

        if (data.type === "MESSAGE_ACK") {
          const msg = data.message;

          // An acknowledgement for a message already in the thread is the
          // server answering a retry of something it had kept all along. It
          // settles the queue, but nothing new has happened - and a send sound
          // for a message that went out some time ago is a lie about the
          // present, which is the same fault the sound had before it was moved
          // off the click.
          const isRepeat = !!queryClient
            .getQueryData<{ messages: ChatMessage[] }>([
              "chat-messages",
              msg.conversationId,
            ])
            ?.messages.some((m) => m.messageId === msg.messageId);

          // Our own message is now accounted for, so a stray delivery of it
          // cannot add it a second time.
          rememberSeen(msg.messageId);

          // The queued copy was the bubble on screen; this is the persisted
          // record that replaces it. Guarded against a refetch having raced us
          // to the same message.
          queryClient.setQueryData<{ messages: ChatMessage[]; cursor?: string }>(
            ["chat-messages", msg.conversationId],
            (old) => {
              if (!old) return old;
              if (old.messages.some((m) => m.messageId === msg.messageId)) return old;
              return { messages: [msg, ...old.messages], cursor: old.cursor };
            }
          );

          // The inbox row's clock stays while anything else of ours in this
          // conversation is still unconfirmed. Clearing it on the first ack
          // showed a sent tick next to a preview of a later message that had
          // not gone out yet, and might still fail.
          const stillPending = useOutboxStore
            .getState()
            .entries.some(
              (e) =>
                e.conversationId === msg.conversationId &&
                e.clientMsgId !== data.clientMsgId &&
                e.status !== "delivered",
            );

          queryClient.setQueryData<{ conversations: Conversation[] }>(
            ["chat-conversations"],
            (old) => {
              if (!old) return old;
              return {
                conversations: old.conversations.map((c) => {
                  if (c.conversationId !== msg.conversationId) return c;
                  // Only claim the preview if we really are the latest. A
                  // message that sat in the queue while the peer kept talking
                  // must not drag the inbox row back to its own timestamp.
                  const isLatest = !c.lastMessageAt || msg.createdAt >= c.lastMessageAt;
                  return {
                    ...c,
                    lastMessagePending: stillPending,
                    ...(isLatest
                      ? {
                          lastMessageAt: msg.createdAt,
                          lastMessageSenderId: msg.senderId,
                          lastMessageReadBy: msg.readBy,
                        }
                      : {}),
                  };
                }),
              };
            }
          );

          // Marked, not dropped. The thread keeps showing this entry until the
          // persisted message is actually on screen, because the two stores do
          // not reach the component in the same frame and dropping it here left
          // one with neither - the message blinked out and back.
          useOutboxStore.getState().markDelivered(data.clientMsgId, msg.messageId);
          // Swept once the handover has certainly happened. Late on purpose:
          // doing it any earlier is the race this exists to avoid.
          setTimeout(() => useOutboxStore.getState().remove(data.clientMsgId), 1000);
          // The sound belongs here rather than on the click, because this is
          // the moment the message is actually delivered - but only when that
          // moment is one the user is watching, and only the first time we
          // learn of it.
          //
          // Two different things to stay quiet about. `isRepeat` is the server
          // answering a retry of a message it had all along: nothing changed.
          // The visibility check is a change nobody is looking at - a queued
          // message going out long after the drawer was closed. Every real
          // send is made from an open thread, so the ordinary case keeps its
          // sound; what is dropped is a chime with nothing on screen to
          // explain it.
          const onScreen = isConversationOnScreen(useChatStore.getState(), msg.conversationId);
          if (!isRepeat && onScreen) playSendSound();
          // This conversation's head is free - let the next one through.
          drain();
        }

        if (data.type === "MESSAGE_REJECTED") {
          // Not a network problem. Retrying would never do anything but repeat
          // itself, so the entry stops and says why.
          logger.warn("[chat] message rejected", data.clientMsgId, data.reason);
          useOutboxStore.getState().markFailed(data.clientMsgId, "rejected");
          drain();
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
          // The inbox tick, in the same cache the rest of the row lives in.
          //
          // This used to be kept in a separate store "so it survives React
          // Query refetches", which inverted the problem: the refetch now
          // carries the server's own answer, and the second copy was the only
          // thing that could be wrong. Here the live frame just gets there
          // first.
          queryClient.setQueryData<{ conversations: Conversation[] }>(
            ["chat-conversations"],
            (old) => {
              if (!old) return old;
              return {
                conversations: old.conversations.map((c) => {
                  if (c.conversationId !== data.conversationId) return c;
                  // Only when the receipt reaches as far as the last message.
                  // A receipt for older history says nothing about it.
                  const coversLast =
                    !!data.readUpTo &&
                    !!c.lastMessageAt &&
                    data.readUpTo >= c.lastMessageAt;
                  return {
                    ...c,
                    lastMessagePending: false,
                    ...(coversLast
                      ? {
                          lastMessageReadBy: [
                            ...new Set([
                              ...(c.lastMessageReadBy ?? []),
                              data.readerId,
                            ]),
                          ],
                        }
                      : {}),
                  };
                }),
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
            // Even a "stopped typing" frame proves they are still connected.
            markOnline(data.conversationId, data.userId);
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
          // Anything still queued for it has nowhere to go. Without this it
          // would keep retrying into a deleted conversation - and, once the
          // server starts answering "gone", sit there as a failed message in a
          // thread the user can no longer open. The same cleanup runs locally
          // when the deletion is ours (see ChatDrawer); this covers the case
          // where the other side did it.
          useOutboxStore.getState().clearConversation(data.conversationId);
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
        // The check that matters most. Everything below belongs to whichever
        // socket is current, and a socket we have already moved on from has no
        // business clearing the connection, or asking for another one.
        if (!isCurrent()) return;

        wsRef.current = null;
        useChatStore.getState().setConnected(false);
        // The next burst after a reconnect must send a fresh start rather than
        // be throttled against a timestamp from the dead socket.
        typingSentAtRef.current = {};
        if (!closed && event.code !== 1000) {
          setTimeout(connect, 3000);
        }
      };
    }

    reconnectRef.current = () => {
      // A reconnect is always a fresh socket, so anything the old one left
      // behind is irrelevant by now.
      setTimeout(connect, 1000);
    };

    connect();

    return () => {
      closed = true;
      reconnectRef.current = null;
      // Detached, not just closed: an `onclose` arriving after a remount has
      // already stored a new socket would clear the ref out from under it.
      detachSocket(wsRef.current);
      wsRef.current = null;
      // Explicit as well as via onclose: a socket still mid-handshake never
      // fires one, and leaving the flag set would tell the user a queued
      // message is about to go out when nothing is listening.
      useChatStore.getState().setConnected(false);
    };
    // `drain` and `rememberSeen` are stable, so listing them here costs
    // nothing - neither can cause a reconnect.
  }, [token, currentUserId, queryClient, drain, rememberSeen]);

  /**
   * Queues a message. Does not touch the socket.
   *
   * It used to, and that was the bug: a write against a socket that was not
   * open was dropped on the floor while the composer cleared itself and the
   * send sound played, so the message vanished with nothing on screen to show
   * for it. The socket is not open more often than it sounds - during a
   * reconnect, a token refresh, or any navigation that remounts the app.
   *
   * Now the queue is the source of truth and `drain` delivers it whenever a
   * connection exists. The bubble stays visible until the server acknowledges
   * it, which is the only moment anything here can honestly call it sent.
   */
  const sendMessage = (
    conversationId: string,
    text: string,
    attachments: ChatAttachment[] = []
  ) => {
    const entry = useOutboxStore.getState().enqueue(conversationId, text, attachments);

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
                  lastMessageAt: entry.createdAt,
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

    // The message clears the peer's indicator on arrival, so the composer's
    // follow-up stop has nothing left to announce - drop the throttle entry
    // and `sendTyping` will skip that frame entirely.
    delete typingSentAtRef.current[conversationId];

    // The queue, not this call, decides when the message goes out. Asking it to
    // move now covers the ordinary case where the socket is already open.
    //
    // Gone with the old send: a blind `setTimeout(..., 800)` that refetched the
    // thread to swap the temp bubble for the persisted record. It was guesswork
    // standing in for an acknowledgement, and when a send had silently failed
    // the refetch is what quietly erased the message from the screen.
    drain();
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