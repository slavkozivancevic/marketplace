"use client";

import { create } from "zustand";

/**
 * What the user has picked to act on, as on WhatsApp: one conversation in the
 * inbox (its header then offers delete) or one message in a thread (copy,
 * edit, delete, react). Never both, never persisted - a selection is a moment,
 * and one surviving a reload would offer to delete something the user no
 * longer has in mind.
 */
export type ChatSelection =
  | { kind: "conversation"; conversationId: string }
  | { kind: "message"; conversationId: string; messageId: string; withReactions: boolean };

interface SelectionStore {
  selected: ChatSelection | null;
  /** The message the composer is editing (picked "edit" in the action bar). */
  editing: { conversationId: string; messageId: string; text: string } | null;
  /** Picks a conversation, replacing any other selection. */
  selectConversation: (conversationId: string) => void;
  /**
   * Picks a message. `withReactions`: the touch long press also opens the
   * emoji bar over it (phones have no hover trigger); the chevron and
   * right-click do not, the desktop hover trigger is already there.
   */
  selectMessage: (conversationId: string, messageId: string, withReactions?: boolean) => void;
  clear: () => void;
  /** Leaves the selection for the composer's edit mode. */
  startEdit: (conversationId: string, messageId: string, text: string) => void;
  /** The edited text as the user types it - apart from the message draft, which survives the edit. */
  setEditText: (text: string) => void;
  stopEdit: () => void;
}

export const useSelectionStore = create<SelectionStore>()((set) => ({
  selected: null,
  editing: null,
  selectConversation: (conversationId) => set({ selected: { kind: "conversation", conversationId } }),
  selectMessage: (conversationId, messageId, withReactions = false) =>
    set({ selected: { kind: "message", conversationId, messageId, withReactions } }),
  clear: () => set({ selected: null }),
  startEdit: (conversationId, messageId, text) =>
    set({ selected: null, editing: { conversationId, messageId, text } }),
  setEditText: (text) => set((s) => (s.editing ? { editing: { ...s.editing, text } } : s)),
  stopEdit: () => set({ editing: null }),
}));
