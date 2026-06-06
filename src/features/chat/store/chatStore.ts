import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatStore {
  isOpen: boolean;
  selectedConvId: string | null;
  /** Total unread across all conversations - drives the header badge. */
  unreadCount: number;
  /** Per-conversation unread counts - drives the inbox row badges. */
  convUnread: Record<string, number>;
  /**
   * Per-conversation read status for the last message.
   * Maps conversationId → readBy[] (user IDs who have read the last message).
   * Maintained by WS events - never overwritten by React Query refetches.
   */
  readStatus: Record<string, string[]>;
  /**
   * Maps conversationId → ISO timestamp of when the user last opened it.
   * Used to detect messages that arrived while the user was offline:
   * if lastMessageAt > lastSeenAt[id], there is an unread message.
   */
  lastSeenAt: Record<string, string>;
  openInbox: () => void;
  openConversation: (conversationId: string) => void;
  close: () => void;
  setSelectedConvId: (id: string | null) => void;
  incrementUnread: (conversationId: string) => void;
  /**
   * Called on conversations load to surface messages that arrived while the
   * user was offline. Compares lastMessageAt against lastSeenAt to decide
   * whether to show a badge. No-op if the conversation already has a live
   * unread count from this session.
   */
  bootstrapUnread: (
    conversationId: string,
    lastMessageAt: string,
    lastReadAt?: string
  ) => void;
  /**
   * Records that the user has seen messages in a conversation up to `at`.
   * Used for messages that arrive while the conversation is already open
   * (auto-marked read by the thread) so the unread badge doesn't reappear
   * on the next sign-in. Never moves lastSeenAt backwards.
   */
  recordSeen: (conversationId: string, at: string) => void;
  setReadStatus: (conversationId: string, readBy: string[]) => void;
}

/** Returns the later of two ISO timestamps; ignores undefined values. */
function maxIso(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

function clearConv(s: ChatStore, id: string): Partial<ChatStore> {
  const count = s.convUnread[id] ?? 0;
  return {
    convUnread: { ...s.convUnread, [id]: 0 },
    lastSeenAt: { ...s.lastSeenAt, [id]: new Date().toISOString() },
    unreadCount: Math.max(0, s.unreadCount - count),
  };
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      isOpen: false,
      selectedConvId: null,
      unreadCount: 0,
      convUnread: {},
      readStatus: {},
      lastSeenAt: {},

      // Opening the inbox shows per-conv badges but doesn't clear them yet.
      openInbox: () => set({ isOpen: true, selectedConvId: null }),

      // Entering a conversation clears its badge and records the seen time.
      openConversation: (id) =>
        set((s) => ({ isOpen: true, selectedConvId: id, ...clearConv(s, id) })),

      close: () => set({ isOpen: false, selectedConvId: null }),

      // Clicking a row inside the inbox - same clearing behaviour.
      setSelectedConvId: (id) =>
        set((s) => {
          if (!id) return { selectedConvId: null };
          return { selectedConvId: id, ...clearConv(s, id) };
        }),

      incrementUnread: (conversationId) =>
        set((s) => ({
          unreadCount: s.unreadCount + 1,
          convUnread: {
            ...s.convUnread,
            [conversationId]: (s.convUnread[conversationId] ?? 0) + 1,
          },
        })),

      bootstrapUnread: (conversationId, lastMessageAt, lastReadAt) =>
        set((s) => {
          // Already has a live unread count from this session - don't double-count.
          if (s.convUnread[conversationId]) return s;
          // The effective "seen" marker is the later of:
          //  - lastReadAt: server-side read receipt, survives storage wipes
          //    (e.g. incognito window closed) - the authoritative source.
          //  - lastSeenAt: locally persisted time we last opened the conv.
          // Folding the server marker into lastSeenAt keeps future comparisons
          // and clearConv math consistent.
          const localSeen = s.lastSeenAt[conversationId];
          const seen = maxIso(localSeen, lastReadAt);
          const folded =
            seen && seen !== localSeen
              ? { lastSeenAt: { ...s.lastSeenAt, [conversationId]: seen } }
              : {};
          // If we've seen up to or past the last message, no badge.
          if (seen && lastMessageAt <= seen) return folded;
          return {
            ...folded,
            convUnread: { ...s.convUnread, [conversationId]: 1 },
            unreadCount: s.unreadCount + 1,
          };
        }),

      recordSeen: (conversationId, at) =>
        set((s) => {
          const cur = s.lastSeenAt[conversationId];
          if (cur && cur >= at) return s;
          return { lastSeenAt: { ...s.lastSeenAt, [conversationId]: at } };
        }),

      setReadStatus: (conversationId, readBy) =>
        set((s) => ({
          readStatus: { ...s.readStatus, [conversationId]: readBy },
        })),
    }),
    {
      name: "chat-unread",
      partialize: (s) => ({
        unreadCount: s.unreadCount,
        convUnread: s.convUnread,
        readStatus: s.readStatus,
        lastSeenAt: s.lastSeenAt,
      }),
    }
  )
);