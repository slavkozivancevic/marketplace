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
  bootstrapUnread: (conversationId: string, lastMessageAt: string) => void;
  setReadStatus: (conversationId: string, readBy: string[]) => void;
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

      bootstrapUnread: (conversationId, lastMessageAt) =>
        set((s) => {
          // Already has a live unread count from this session - don't double-count.
          if (s.convUnread[conversationId]) return s;
          // Compare lastMessageAt against when we last opened this conversation.
          // If we've never opened it, or the message is newer, show a badge.
          const lastSeen = s.lastSeenAt[conversationId];
          if (lastSeen && lastMessageAt <= lastSeen) return s;
          return {
            convUnread: { ...s.convUnread, [conversationId]: 1 },
            unreadCount: s.unreadCount + 1,
          };
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