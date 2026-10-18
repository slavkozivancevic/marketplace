import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * One staged file in a composer draft.
 *
 * `file` and `abort` are live browser objects, which is why the attachment map
 * never reaches storage (see `partialize`). The upload itself is already on S3
 * by the time `status` is "done", and the bucket's lifecycle rule sweeps a key
 * that never gets committed to a message, so dropping these on a reload costs
 * nothing but the user re-picking the file.
 */
export interface DraftAttachment {
  id: string;
  file: File;
  key?: string;
  width?: number;
  height?: number;
  progress: number;
  status: "uploading" | "done" | "error";
  abort?: AbortController;
}

interface DraftStore {
  /** conversationId -> composer text. Persisted. */
  text: Record<string, string>;
  /** conversationId -> staged files. Deliberately NOT persisted. */
  attachments: Record<string, DraftAttachment[]>;
  setText: (conversationId: string, text: string) => void;
  /** Takes an updater so call sites keep the `setState`-style shape. */
  setAttachments: (
    conversationId: string,
    update: (prev: DraftAttachment[]) => DraftAttachment[],
  ) => void;
  /** Forgets a conversation's draft entirely - on send, and on delete. */
  clearDraft: (conversationId: string) => void;
}

/** Drops a key from a record, returning the same object when there is nothing to drop. */
function without<T>(
  map: Record<string, T>,
  key: string,
): Record<string, T> | null {
  if (!(key in map)) return null;
  const next = { ...map };
  delete next[key];
  return next;
}

/**
 * The composer draft, per conversation.
 *
 * It lives outside `MessageThread` because that component is NOT remounted when
 * you switch conversation - only its `conversationId` prop changes. Local state
 * there is therefore shared by every conversation: a half-typed message for one
 * person sat in the box for the next one, and Enter sent it to them. Staged
 * attachments did the same, which made it a leak rather than an annoyance.
 *
 * Keying by conversation fixes that and buys the behaviour you want anyway -
 * leave a conversation mid-sentence, come back, the sentence is still there.
 */
export const useDraftStore = create<DraftStore>()(
  persist(
    (set) => ({
      text: {},
      attachments: {},

      setText: (conversationId, text) =>
        set((s) =>
          s.text[conversationId] === text
            ? s
            : { text: { ...s.text, [conversationId]: text } },
        ),

      setAttachments: (conversationId, update) =>
        set((s) => {
          const prev = s.attachments[conversationId] ?? [];
          const next = update(prev);
          if (next === prev) return s;
          return {
            attachments: { ...s.attachments, [conversationId]: next },
          };
        }),

      clearDraft: (conversationId) =>
        set((s) => {
          const text = without(s.text, conversationId);
          const attachments = without(s.attachments, conversationId);
          if (!text && !attachments) return s;
          return {
            ...(text ? { text } : {}),
            ...(attachments ? { attachments } : {}),
          };
        }),
    }),
    {
      name: "chat-drafts",
      // sessionStorage, not localStorage: an unsent message belongs to this tab
      // and this sitting. It still survives what actually loses state today -
      // closing the drawer, a locale switch (which remounts the whole `[locale]`
      // subtree) and a reload - which is the whole point.
      //
      // On the server `sessionStorage` is undefined; `createJSONStorage` catches
      // that and returns undefined, which turns persistence into a no-op rather
      // than throwing while a client component renders through SSR.
      storage: createJSONStorage(() => sessionStorage),
      // `attachments` is intentionally absent - it holds File and
      // AbortController instances, which do not survive JSON.
      partialize: (s) => ({ text: s.text }),
    },
  ),
);
