import { SCROLLBAR_BOOTSTRAP_HTML } from "@/lib/scrollbars/scrollbarStyle";

/**
 * Puts the app's scrollbar style and platform detection
 * (`src/lib/scrollbars/scrollbarStyle.ts`) into a React-rendered document.
 * Goes at the top of `<body>` in every root layout and in `global-error.tsx`;
 * the static 404 includes the same bootstrap as a string.
 *
 * Same `dangerouslySetInnerHTML` wrapper as `FoucScript`, for the same React
 * 19 reason (see there): the browser's parser runs the script inline on first
 * load, and React never sees a `<script>` element. The `<style>` applies even
 * though its wrapper is hidden.
 */
export function ScrollbarScript() {
  return (
    <div
      hidden
      style={{ display: "none" }}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: SCROLLBAR_BOOTSTRAP_HTML }}
    />
  );
}
