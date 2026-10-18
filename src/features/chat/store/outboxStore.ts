import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatAttachment } from "../types";
import type { OutboxEntry, OutboxFailure } from "../utils/outbox";

interface OutboxStore {
  /** Every message the signed-in user has awaiting confirmation, oldest first. */
  entries: OutboxEntry[];
  /** Whose queue `entries` is. Null until the chat first learns who is signed in. */
  ownerId: string | null;
  /** Other accounts' unsent queues, held until that account signs in here again. */
  parked: Record<string, OutboxEntry[]>;
  /**
   * Makes `entries` the queue of `userId`, parking whatever belonged to the
   * previous account. Must run before anything drains the queue.
   */
  bindOwner: (userId: string) => void;
  enqueue: (
    conversationId: string,
    text: string,
    attachments: ChatAttachment[],
  ) => OutboxEntry;
  /** Hands an entry to the socket: counts the attempt and starts the ack clock. */
  markSending: (clientMsgId: string, now: number) => void;
  /** Puts an attempt back in line, not before `nextAttemptAt`. */
  markQueued: (clientMsgId: string, nextAttemptAt: number) => void;
  /**
   * Confirmed. The entry is kept, not dropped, so the thread can hand over to
   * the persisted message without a frame showing neither - see `deliveredAs`.
   */
  markDelivered: (clientMsgId: string, messageId: string) => void;
  markFailed: (clientMsgId: string, reason: OutboxFailure) => void;
  /** Confirmed, or discarded by the user - either way it leaves the queue. */
  remove: (clientMsgId: string) => void;
  /** Manual retry: a clean slate, so the user is not held to the old backoff. */
  retry: (clientMsgId: string) => void;
  /** Drops a whole conversation's queue, for when the conversation itself goes. */
  clearConversation: (conversationId: string) => void;
}

/** Applies a patch to one entry, leaving the array alone when nothing matches. */
function patch(
  entries: OutboxEntry[],
  clientMsgId: string,
  update: (entry: OutboxEntry) => OutboxEntry,
): OutboxEntry[] | null {
  const index = entries.findIndex((e) => e.clientMsgId === clientMsgId);
  if (index === -1) return null;
  const next = [...entries];
  next[index] = update(next[index]);
  return next;
}

/**
 * Messages that have been sent but not yet confirmed.
 *
 * It exists because a send had no way of failing visibly. The socket drops
 * anything written while it is not open - and it is not open during a
 * reconnect, a token refresh or any navigation that remounts the app - while
 * the composer cleared itself and the send sound played regardless. The message
 * was simply gone, with nothing on screen to say so.
 *
 * So a send no longer talks to the socket at all. It appends here, and this
 * queue is drained by whatever connection happens to be alive, with the bubble
 * staying on screen until the server acknowledges it by `clientMsgId`.
 *
 * Persisted to localStorage, unlike the composer draft in `draftStore`, which
 * is a sessionStorage affair. The difference is intent: a draft is something
 * you were still thinking about, a queued message is something you have already
 * said. It has to survive a crashed tab.
 *
 * Kept per account. localStorage belongs to the browser, not to whoever is
 * signed in, so one shared queue let a message A wrote offline drain over B's
 * socket after A signed out and B signed in - posted as B if B was in that
 * conversation. `bindOwner` swaps the active queue on a change of account and
 * parks the other one instead of dropping it.
 */
export const useOutboxStore = create<OutboxStore>()(
  persist(
    (set) => ({
      entries: [],
      ownerId: null,
      parked: {},

      bindOwner: (userId) =>
        set((s) => {
          if (!userId || s.ownerId === userId) return s;
          // No owner yet: a queue persisted before ownership was tracked. It
          // can only have been written by whoever used this browser's chat
          // last, and that is the account signing in now in every case but a
          // switch - adopt it rather than strand it.
          if (s.ownerId === null) return { ownerId: userId };
          const parked = { ...s.parked };
          if (s.entries.length > 0) parked[s.ownerId] = s.entries;
          const entries = parked[userId] ?? [];
          delete parked[userId];
          return { ownerId: userId, entries, parked };
        }),

      enqueue: (conversationId, text, attachments) => {
        const entry: OutboxEntry = {
          clientMsgId: crypto.randomUUID(),
          conversationId,
          text,
          attachments,
          createdAt: new Date().toISOString(),
          attempts: 0,
          status: "queued",
        };
        set((s) => ({ entries: [...s.entries, entry] }));
        return entry;
      },

      markSending: (clientMsgId, now) =>
        set((s) => {
          const entries = patch(s.entries, clientMsgId, (e) => ({
            ...e,
            status: "sending",
            attempts: e.attempts + 1,
            sentAt: now,
            nextAttemptAt: undefined,
          }));
          return entries ? { entries } : s;
        }),

      markQueued: (clientMsgId, nextAttemptAt) =>
        set((s) => {
          const entries = patch(s.entries, clientMsgId, (e) => ({
            ...e,
            status: "queued",
            sentAt: undefined,
            nextAttemptAt,
          }));
          return entries ? { entries } : s;
        }),

      markDelivered: (clientMsgId, messageId) =>
        set((s) => {
          const entries = patch(s.entries, clientMsgId, (e) => ({
            ...e,
            status: "delivered",
            deliveredAs: messageId,
            sentAt: undefined,
            nextAttemptAt: undefined,
          }));
          return entries ? { entries } : s;
        }),

      markFailed: (clientMsgId, reason) =>
        set((s) => {
          const entries = patch(s.entries, clientMsgId, (e) => ({
            ...e,
            status: "failed",
            failedReason: reason,
            sentAt: undefined,
            nextAttemptAt: undefined,
          }));
          return entries ? { entries } : s;
        }),

      remove: (clientMsgId) =>
        set((s) => {
          const entries = s.entries.filter((e) => e.clientMsgId !== clientMsgId);
          return entries.length === s.entries.length ? s : { entries };
        }),

      retry: (clientMsgId) =>
        set((s) => {
          const entries = patch(s.entries, clientMsgId, (e) => ({
            ...e,
            status: "queued",
            attempts: 0,
            failedReason: undefined,
            sentAt: undefined,
            nextAttemptAt: undefined,
          }));
          return entries ? { entries } : s;
        }),

      clearConversation: (conversationId) =>
        set((s) => {
          const entries = s.entries.filter(
            (e) => e.conversationId !== conversationId,
          );
          return entries.length === s.entries.length ? s : { entries };
        }),
    }),
    {
      name: "chat-outbox",
      partialize: (s) => ({
        entries: s.entries,
        ownerId: s.ownerId,
        parked: s.parked,
      }),
      // A tab that died mid-attempt leaves an entry claiming to be in flight,
      // with an ack that is never coming. Put those back in line on load:
      // resending is safe because the server deduplicates on `clientMsgId`,
      // whereas trusting the old status would strand the message behind its own
      // conversation's head forever.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const settle = (entries: OutboxEntry[]) =>
          entries
            // A delivered entry only lingers to cover the handover on screen,
            // and that screen is gone. The message is in the thread; sweep it.
            .filter((e) => e.status !== "delivered")
            .map((e) =>
              e.status === "sending"
                ? { ...e, status: "queued" as const, sentAt: undefined }
                : e,
            );
        state.entries = settle(state.entries);
        // Absent from a queue persisted before accounts were told apart.
        state.ownerId ??= null;
        state.parked = Object.fromEntries(
          Object.entries(state.parked ?? {}).map(([id, q]) => [id, settle(q)]),
        );
      },
    },
  ),
);
