"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { clearInstallPrompt, getInstallPrompt, INSTALL_PROMPT_EVENT } from "./installPromptScript";
import { resolveInstallKind, type InstallKind } from "./resolveInstallKind";

const STANDALONE_QUERY = "(display-mode: standalone)";

type NavigatorWithInstallInfo = Navigator & {
  standalone?: boolean;
  getInstalledRelatedApps?: () => Promise<unknown[]>;
};

/**
 * Set once `getInstalledRelatedApps()` reports this app on the device. The
 * manifest lists itself under `related_applications`, so Chrome on Android
 * answers for a browser tab of the same site. Module-level: the answer holds
 * for the page's lifetime, and both header copies of the menu share it.
 */
let installedOnDevice = false;
let installedCheck: Promise<void> | null = null;

function checkInstalledOnce(): Promise<void> {
  installedCheck ??= (async () => {
    const nav = navigator as NavigatorWithInstallInfo;
    if (!nav.getInstalledRelatedApps) return;
    try {
      const apps = await nav.getInstalledRelatedApps();
      if (apps.length > 0) {
        installedOnDevice = true;
        window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
      }
    } catch {
      // Unsupported or blocked: fall back to the other signals.
    }
  })();
  return installedCheck;
}

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
  const nav = navigator as NavigatorWithInstallInfo;
  return resolveInstallKind({
    hasPrompt: getInstallPrompt() !== null,
    standalone: window.matchMedia(STANDALONE_QUERY).matches || nav.standalone === true,
    installed: installedOnDevice,
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints,
  });
}

// Nothing on the server or the hydration render: the entry appears after
// mount, so server and client markup always match.
const getServerSnapshot = (): InstallKind => null;

/**
 * Whether this device can install the app right now, and how. Hidden inside
 * the installed app, in a browser tab once the app is installed (Android:
 * `appinstalled` in this tab, Chrome withholding the prompt on later loads,
 * and `getInstalledRelatedApps()`), and on desktop. `install()` opens the
 * browser's own install dialog ("prompt" only). The captured event is
 * single-use, so it is dropped after the dialog closes either way - Chrome
 * fires a fresh one on a later page load if the app is still not installed.
 */
export function useInstallApp() {
  const kind = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [prompting, setPrompting] = useState(false);

  useEffect(() => {
    void checkInstalledOnce();
  }, []);

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
