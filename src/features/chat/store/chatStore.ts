import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatStore {
  isOpen: boolean;
  selectedConvId: string | null;
  /** Total unread across all conversations — drives the header badge. */
  unreadCount: number;
  /** Per-conversation unread counts — drives the inbox row badges. */
  convUnread: Record<string, number>;
  /**
   * Per-conversation read status for the last message.
   * Maps conversationId → readBy[] (user IDs who have read the last message).
   * Maintained by WS events — never overwritten by React Query refetches.
   */
  readStatus: Record<string, string[]>;
  openInbox: () => void;
  openConversation: (conversationId: string) => void;
  close: () => void;
  setSelectedConvId: (id: string | null) => void;
  incrementUnread: (conversationId: string) => void;
  setReadStatus: (conversationId: string, readBy: string[]) => void;
}

function clearConv(s: ChatStore, id: string): Partial<ChatStore> {
  const count = s.convUnread[id] ?? 0;
  const convUnread = { ...s.convUnread };
  delete convUnread[id];
  return {
    convUnread,
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

      // Opening the inbox shows per-conv badges but doesn't clear them yet.
      openInbox: () => set({ isOpen: true, selectedConvId: null }),

      // Entering a conversation clears its badge.
      openConversation: (id) =>
        set((s) => ({ isOpen: true, selectedConvId: id, ...clearConv(s, id) })),

      close: () => set({ isOpen: false, selectedConvId: null }),

      // Clicking a row inside the inbox — same clearing behaviour.
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

      setReadStatus: (conversationId, readBy) =>
        set((s) => ({
          readStatus: { ...s.readStatus, [conversationId]: readBy },
        })),
    }),
    {
      name: "chat-unread",
      // Only persist the badge counts and read status, not the UI open/close state.
      partialize: (s) => ({
        unreadCount: s.unreadCount,
        convUnread: s.convUnread,
        readStatus: s.readStatus,
      }),
    }
  )
);