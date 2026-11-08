import { INSTALL_PROMPT_SCRIPT_JS } from "../installPromptScript";

const MARKUP = `<script>${INSTALL_PROMPT_SCRIPT_JS}</script>`;

/**
 * Inline script that keeps Chrome's `beforeinstallprompt` event for the
 * "Install app" entry in the preferences menu. Wrapped in a hidden div's
 * innerHTML for the same React 19 "script inside a component" reason as
 * `FoucScript` (see there).
 */
export function InstallPromptScript() {
  return (
    <div
      hidden
      style={{ display: "none" }}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: MARKUP }}
    />
  );
}
