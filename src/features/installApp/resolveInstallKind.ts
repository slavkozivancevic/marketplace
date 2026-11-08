/**
 * What the "Install app" entry can do on this device:
 * - "prompt": an Android browser handed us its install prompt (Chrome, Edge,
 *   Samsung Internet);
 * - "ios": iPhone/iPad, where no browser exposes a prompt, so we show the
 *   Share -> Add to Home Screen steps;
 * - null: nothing to offer (already the installed app, or a browser such as
 *   Firefox desktop that cannot install).
 */
export type InstallKind = "prompt" | "ios" | null;

export function resolveInstallKind(input: {
  hasPrompt: boolean;
  standalone: boolean;
  /** `getInstalledRelatedApps()` found this app on the device (Android Chrome). */
  installed: boolean;
  userAgent: string;
  maxTouchPoints: number;
}): InstallKind {
  if (input.standalone || input.installed) return null;
  // Phones and tablets only. Desktop Chrome/Edge fire the prompt too, but an
  // installed shop window on a computer is not something buyers look for, so
  // the entry would only be noise in the menu there.
  if (input.hasPrompt && /Android/.test(input.userAgent)) return "prompt";
  if (isIos(input.userAgent, input.maxTouchPoints)) return "ios";
  return null;
}

function isIos(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  // iPadOS Safari asks for desktop sites and reports a Mac UA; a Mac has no
  // touch screen, so touch points tell them apart.
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}
