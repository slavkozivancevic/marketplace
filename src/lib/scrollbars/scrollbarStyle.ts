/**
 * The ONE source of the app's scrollbar look and of the platform detection
 * behind it. Every document the app serves includes it - both root layouts and
 * `global-error.tsx` through `<ScrollbarScript />`, and the proxy's static 404
 * (`notFoundResponse`) as a string - so no surface can show a different
 * scrollbar. `scrollbars.test.ts` fails CI on a document that leaves it out,
 * and on any scrollbar rule in `globals.css`.
 *
 * The look: a 6px rounded thumb on a transparent 10px lane, no arrow buttons,
 * growing to 8px while the pointer is on the thumb (the lane never changes
 * size, so nothing beside it moves). `ScrollArea` draws the same thumb as a
 * Radix overlay from the same tokens.
 *
 * Rules that compile, render, and quietly break it:
 *
 * - Chromium IGNORES every `::-webkit-scrollbar` rule on an element that has
 *   `scrollbar-width` or `scrollbar-color` set and falls back to the system
 *   "thin" scrollbar - the one with arrows on Windows. So the standard
 *   properties are only for browsers without the pseudo-elements (Firefox).
 *
 * - The webkit rules apply only where the platform draws classic scrollbars
 *   that take layout width (`data-scrollbars="classic"`, measured by the
 *   script below before first paint). macOS, iOS and Android draw a slim
 *   overlay; styling `::-webkit-scrollbar` there would turn it into a classic
 *   lane. On those platforms `ScrollArea` steps aside too - its bars hide and
 *   its viewport gets the system scrollbar back - so a device never mixes two
 *   kinds.
 *
 * - Each classic selector comes in two forms: `html[...] ::-webkit-scrollbar`
 *   (with a space) matches scroll containers INSIDE the document, and
 *   `html[...]::-webkit-scrollbar` the document's own scrollbar - the one a
 *   page that scrolls at the root (the static 404) shows.
 *
 * - The tokens live on `*`, not `:root`, so `var(--foreground)` resolves in
 *   each element's own theme scope (light / dark / cosmos). `currentColor` is
 *   the fallback for a document without the app's theme tokens.
 */

const C = 'html[data-scrollbars="classic"]';
const O = 'html[data-scrollbars="overlay"]';

/** `[inside, root]` selector pair for a scrollbar pseudo-element on classic platforms. */
const classic = (pseudo: string) => `${C} ${pseudo}, ${C}${pseudo}`;

export const SCROLLBAR_CSS = `
* {
  --scrollbar-thumb: color-mix(in oklab, var(--foreground, currentColor) 25%, transparent);
  --scrollbar-thumb-hover: color-mix(in oklab, var(--foreground, currentColor) 40%, transparent);
  --scrollbar-thumb-active: color-mix(in oklab, var(--foreground, currentColor) 50%, transparent);
}

@supports not selector(::-webkit-scrollbar) {
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) transparent;
  }
}

${classic("::-webkit-scrollbar")} {
  width: 10px;
  height: 10px;
}

${classic("::-webkit-scrollbar-track")}, ${classic("::-webkit-scrollbar-corner")} {
  background: transparent;
}

${classic("::-webkit-scrollbar-button")} {
  display: none;
}

${classic("::-webkit-scrollbar-thumb")} {
  background-color: var(--scrollbar-thumb);
  background-clip: padding-box;
  border: 2px solid transparent;
  border-radius: 9999px;
}

${classic("::-webkit-scrollbar-thumb:hover")} {
  background-color: var(--scrollbar-thumb-hover);
  border-width: 1px;
}

${classic("::-webkit-scrollbar-thumb:active")} {
  background-color: var(--scrollbar-thumb-active);
  border-width: 1px;
}

${O} [data-slot="scroll-area-bar"] {
  display: none;
}

${O} [data-radix-scroll-area-viewport] {
  scrollbar-width: auto;
}
`;

/**
 * Marks `<html data-scrollbars>` as `classic` when the platform's scrollbars
 * take layout width (Windows, Linux, macOS with "always show") and `overlay`
 * when they take none (macOS default, iOS, Android). Measured, not sniffed
 * from the user agent: a probe with `overflow: scroll` is exactly as wide as
 * the scrollbar the browser will draw, and a Mac with a mouse plugged in
 * switches to classic scrollbars without changing its UA.
 *
 * Must run at the top of `<body>` (the probe needs `document.body`), before
 * first paint, so a classic platform never shows one frame of the unstyled
 * system scrollbar.
 */
export const SCROLLBAR_SCRIPT_JS = `(function(){
try {
  var probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll';
  document.body.appendChild(probe);
  var classic = probe.offsetWidth - probe.clientWidth > 0;
  document.body.removeChild(probe);
  document.documentElement.setAttribute('data-scrollbars', classic ? 'classic' : 'overlay');
} catch (e) {}
})();`;

/** Style + detection, ready to drop at the top of a document's `<body>`. */
export const SCROLLBAR_BOOTSTRAP_HTML = `<style>${SCROLLBAR_CSS}</style><script>${SCROLLBAR_SCRIPT_JS}</script>`;
