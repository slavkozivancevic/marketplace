"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { clearInstallPrompt, getInstallPrompt, INSTALL_PROMPT_EVENT } from "./installPromptScript";
import { resolveInstallKind, type InstallKind } from "./resolveInstallKind";

const STANDALONE_QUERY = "(display-mode: standalone)";

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(STANDALONE_QUERY);
  window.addEventListener(INSTALL_PROMPT_EVENT, onChange);
  mq.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(INSTALL_PROMPT_EVENT, onChange);
    mq.removeEventListener("change", onChange);
  };
}

function getSnapshot(): InstallKind {
  return resolveInstallKind({
    hasPrompt: getInstallPrompt() !== null,
    standalone:
      window.matchMedia(STANDALONE_QUERY).matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

// Nothing on the server or the hydration render: the entry appears after
// mount, so server and client markup always match.
const getServerSnapshot = (): InstallKind => null;

/**
 * Whether this device can install the app right now, and how. `install()`
 * opens the browser's own install dialog ("prompt" only). The captured event
 * is single-use, so it is dropped after the dialog closes either way - Chrome
 * fires a fresh one on a later page load if the app is still not installed.
 */
export function useInstallApp() {
  const kind = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [prompting, setPrompting] = useState(false);

  const install = useCallback(async () => {
    const event = getInstallPrompt();
    if (!event) return;
    setPrompting(true);
    try {
      await event.prompt();
      await event.userChoice;
    } finally {
      clearInstallPrompt();
      setPrompting(false);
    }
  }, []);

  return { kind, install, prompting };
}
