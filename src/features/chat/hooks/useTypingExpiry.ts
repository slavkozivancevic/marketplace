"use client";

import { useEffect } from "react";
import { useChatStore } from "../store/chatStore";

/**
 * Expires stale typing signals.
 *
 * Deliberately not a `setInterval`: a 1s tick running for the whole session
 * would wake the main thread thousands of times to do nothing. Instead this
 * arms a single timer at the soonest expiry across every conversation. When it
 * fires, the prune changes the store, this effect re-runs, and it arms the
 * next one. With nobody typing there is no timer at all.
 *
 * Mounted once, next to the socket - the inbox row preview has to expire even
 * when the drawer is closed.
 */
export function useTypingExpiry() {
  const typing = useChatStore((s) => s.typing);
  const pruneTyping = useChatStore((s) => s.pruneTyping);

  useEffect(() => {
    const expiries = Object.values(typing).flatMap((typers) =>
      Object.values(typers),
    );
    if (expiries.length === 0) return;

    // A signal that is already stale (tab was backgrounded, timers throttled)
    // still goes through a timeout rather than a synchronous prune, so the
    // store is never written during render.
    const delay = Math.max(0, Math.min(...expiries) - Date.now());
    const timer = setTimeout(pruneTyping, delay);
    return () => clearTimeout(timer);
  }, [typing, pruneTyping]);
}
