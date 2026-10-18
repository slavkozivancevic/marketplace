"use client";

import { useCallback, useSyncExternalStore } from "react";

/** The query parameter holding the open conversation on `/messages`. */
const PARAM = "c";
/** Fired after this module writes the URL - `pushState` itself fires nothing. */
const CHANGE_EVENT = "chat:conversation-param";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function getSnapshot(): string | null {
  return new URLSearchParams(window.location.search).get(PARAM);
}

// The page renders only on the client (it waits for the chat connection),
// so the server never has a conversation to report.
function getServerSnapshot(): string | null {
  return null;
}

/**
 * The open conversation as the address bar holds it, kept in step with Back
 * and Forward.
 *
 * Read from `location` and `popstate` directly rather than through
 * `useSearchParams` (and so nuqs): after Back onto an entry created by a
 * shallow `pushState`, `useSearchParams` kept the old value - the address bar
 * said `/messages`, the page still showed the conversation. The browser's own
 * events are the one source that cannot disagree with the address bar.
 *
 * Writes go through `history` with a `null` state, which Next's patched
 * `pushState`/`replaceState` fill with its router state, so Back still lands
 * on a soft navigation instead of a reload.
 */
export function useUrlConversationId() {
  const conversationId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setConversationId = useCallback(
    (id: string | null, { replace = false }: { replace?: boolean } = {}) => {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set(PARAM, id);
      else url.searchParams.delete(PARAM);
      if (url.href === window.location.href) return;
      if (replace) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    []
  );

  return [conversationId, setConversationId] as const;
}
