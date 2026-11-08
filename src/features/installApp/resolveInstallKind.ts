/**
 * What the "Install app" entry can do on this device:
 * - "prompt": the browser handed us its install prompt (Chrome, Edge,
 *   Samsung Internet - Android and desktop);
 * - "ios": iPhone/iPad, where no browser exposes a prompt, so we show the
 *   Share -> Add to Home Screen steps;
 * - null: nothing to offer (already the installed app, or a browser such as
 *   Firefox desktop that cannot install).
 */
export type InstallKind = "prompt" | "ios" | null;

export function resolveInstallKind(input: {
  hasPrompt: boolean;
  standalone: boolean;
  userAgent: string;
  maxTouchPoints: number;
}): InstallKind {
  if (input.standalone) return null;
  if (input.hasPrompt) return "prompt";
  if (isIos(input.userAgent, input.maxTouchPoints)) return "ios";
  return null;
}

function isIos(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  // iPadOS Safari asks for desktop sites and reports a Mac UA; a Mac has no
  // touch screen, so touch points tell them apart.
  return /Macintosh/.test(userAgent) && maxTouchPoints > 1;
}
