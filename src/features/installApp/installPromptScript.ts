/**
 * Window state the inline head script shares with `useInstallApp`.
 * `beforeinstallprompt` is not in lib.dom, hence the local type.
 */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export const INSTALL_PROMPT_KEY = "__mvInstallPrompt";
export const INSTALL_PROMPT_EVENT = "mv:installprompt";

/** The captured event, or null/undefined when there is nothing to offer. */
export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  const w = window as unknown as Record<string, BeforeInstallPromptEvent | null | undefined>;
  return w[INSTALL_PROMPT_KEY] ?? null;
}

/** Drops the captured event (it is single-use) and tells subscribers. */
export function clearInstallPrompt(): void {
  (window as unknown as Record<string, unknown>)[INSTALL_PROMPT_KEY] = null;
  window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
}

/**
 * Runs at HTML-parse time. Chrome can fire `beforeinstallprompt` before React
 * hydrates, and it fires once per page load, so a listener added in an effect
 * misses it. The event is kept on `window` for `useInstallApp`; no
 * `preventDefault`, so Chrome's own install infobar still shows as before.
 * `appinstalled` clears it - the entry must vanish once the app is installed.
 *
 * Self-contained: `InstallPromptScript` inlines this function's source text.
 */
export function captureInstallPrompt(key: string, eventName: string): void {
  const w = window as unknown as Record<string, unknown>;
  const notify = () => window.dispatchEvent(new Event(eventName));
  window.addEventListener("beforeinstallprompt", (e) => {
    w[key] = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    w[key] = null;
    notify();
  });
}

export const INSTALL_PROMPT_SCRIPT_JS = `(function(){try{(${captureInstallPrompt.toString()})(${JSON.stringify(
  INSTALL_PROMPT_KEY,
)},${JSON.stringify(INSTALL_PROMPT_EVENT)});}catch(e){}})();`;
