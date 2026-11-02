"use client";

import { create } from "zustand";
import type { ChatMessage } from "../types";
import { toggleId } from "../utils/selection";

/**
 * What the user has picked to act on, as on WhatsApp: conversations in the
 * inbox (delete, mark read / unread) or messages in one thread (reply, copy,
 * edit, delete, react - depending on what is picked). Never both, never
 * persisted - a selection is a moment, and one surviving a reload would offer
 * to delete something the user no longer has in mind.
 *
 * While anything is picked the surface is in SELECTION MODE: a tap toggles an
 * item instead of opening it, and the mode ends when the last one is un-picked.
 */
export type ChatSelection =
  | { kind: "conversations"; ids: string[] }
  | { kind: "messages"; conversationId: string; ids: string[]; withReactions: boolean };

interface SelectionStore {
  selected: ChatSelection | null;
  /** The message the composer is editing (picked "edit"). */
  editing: { conversationId: string; messageId: string; text: string } | null;
  /** The message the composer is answering (swipe, or picked "reply"). */
  replying: { conversationId: string; message: ChatMessage } | null;
  /** Enters selection mode in the inbox with this conversation. */
  selectConversation: (conversationId: string) => void;
  /** A tap in selection mode. `false` when the selection is full. */
  toggleConversation: (conversationId: string) => boolean;
  /**
   * Enters selection mode in a thread with this message. `withReactions`: the
   * touch long press also opens the emoji bar over it (phones have no hover
   * trigger); right-click and the menu do not.
   */
  selectMessage: (conversationId: string, messageId: string, withReactions?: boolean) => void;
  /** A tap in selection mode. `false` when the selection is full. */
  toggleMessage: (conversationId: string, messageId: string) => boolean;
  clear: () => void;
  /** Leaves the selection for the composer's edit mode. */
  startEdit: (conversationId: string, messageId: string, text: string) => void;
  /** The edited text as the user types it - apart from the message draft, which survives the edit. */
  setEditText: (text: string) => void;
  stopEdit: () => void;
  /** Leaves the selection (and any edit) for a reply to `message`. */
  startReply: (conversationId: string, message: ChatMessage) => void;
  stopReply: () => void;
}

export const useSelectionStore = create<SelectionStore>()((set, get) => ({
  selected: null,
  editing: null,
  replying: null,
  selectConversation: (conversationId) =>
    set({ selected: { kind: "conversations", ids: [conversationId] } }),
  toggleConversation: (conversationId) => {
    const s = get().selected;
    if (s?.kind !== "conversations") {
      set({ selected: { kind: "conversations", ids: [conversationId] } });
      return true;
    }
    const next = toggleId(s.ids, conversationId);
    if (next.full) return false;
    set({ selected: next.ids.length ? { kind: "conversations", ids: next.ids } : null });
    return true;
  },
  selectMessage: (conversationId, messageId, withReactions = false) =>
    set({ selected: { kind: "messages", conversationId, ids: [messageId], withReactions } }),
  toggleMessage: (conversationId, messageId) => {
    const s = get().selected;
    if (s?.kind !== "messages" || s.conversationId !== conversationId) {
      set({ selected: { kind: "messages", conversationId, ids: [messageId], withReactions: false } });
      return true;
    }
    const next = toggleId(s.ids, messageId);
    if (next.full) return false;
    // The emoji bar belongs to exactly one picked message (WhatsApp); a second
    // one picked closes it for good.
    set({
      selected: next.ids.length
        ? { kind: "messages", conversationId, ids: next.ids, withReactions: false }
        : null,
    });
    return true;
  },
  clear: () => set({ selected: null }),
  startEdit: (conversationId, messageId, text) =>
    set({ selected: null, replying: null, editing: { conversationId, messageId, text } }),
  setEditText: (text) => set((s) => (s.editing ? { editing: { ...s.editing, text } } : s)),
  stopEdit: () => set({ editing: null }),
  startReply: (conversationId, message) =>
    set({ selected: null, editing: null, replying: { conversationId, message } }),
  stopReply: () => set({ replying: null }),
}));

/** Whether this thread is in selection mode. */
export function useMessageSelectionActive(conversationId: string | null): boolean {
  return useSelectionStore(
    (s) => s.selected?.kind === "messages" && s.selected.conversationId === conversationId,
  );
}
