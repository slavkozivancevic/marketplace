import { THEMES, THEME_COOKIE_NAME, RESOLVED_THEMES } from "./constants";

/**
 * Synchronous theme bootstrap that runs at HTML-parse time, before the
 * browser paints anything user-visible. Reads the user's saved preference
 * from the `theme` cookie (mirrored by `<ThemeProvider>`'s `setTheme`) and
 * applies the resolved class to `<html>` so the very first paint already
 * has the right theme - no flash even for cosmos/dark/light overrides.
 *
 * Why a `<div dangerouslySetInnerHTML>` containing a `<script>` rather than
 * a `<script>` element directly: React 19 fires a "script inside a React
 * component" warning every time it encounters a `<script>` element in the
 * render tree on the client, INCLUDING the reconciliation pass that runs
 * when `LocaleRootLayout` re-renders on locale change. The warning fires
 * for server components too, because their rendered output is still part
 * of the React tree that the client reconciles.
 *
 * By wrapping the script as a STRING inside `dangerouslySetInnerHTML`, the
 * script element never enters React's virtual DOM - React only sees a
 * `<div>` whose `innerHTML` happens to be a literal HTML string. On
 * initial SSR, the browser's HTML parser walks the document, encounters
 * the `<script>` mid-parse, and executes it inline (per HTML spec scripts
 * in initial HTML execute regardless of nesting). On client re-renders
 * the same `dangerouslySetInnerHTML` value is reapplied to the div via
 * `innerHTML`, which by spec does NOT re-execute scripts - which is the
 * correct behavior anyway since the theme was already applied on first
 * paint.
 *
 * No cookies are read server-side (which would have made this layout
 * dynamic and broken `cacheComponents` prerender of descendant pages).
 * The script reads `document.cookie` on the user's machine, which is the
 * only place that data lives for FOUC purposes.
 */
const FOUC_SCRIPT_JS = `(function(){
try {
  var match = document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE_NAME}=([^;]+)/);
  var raw = match && match[1];
  var THEMES = ${JSON.stringify(THEMES)};
  var RESOLVED = ${JSON.stringify(RESOLVED_THEMES)};
  var stored = THEMES.indexOf(raw) !== -1 ? raw : 'system';
  var resolved = stored === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : stored;
  var html = document.documentElement;
  for (var i = 0; i < RESOLVED.length; i++) html.classList.remove(RESOLVED[i]);
  html.classList.add(resolved);
  html.style.colorScheme = (resolved === 'dark' || resolved === 'cosmos') ? 'dark' : 'light';
} catch (e) {}
})();`;

const FOUC_MARKUP = `<script>${FOUC_SCRIPT_JS}</script>`;

export function FoucScript() {
  return (
    <div
      hidden
      style={{ display: "none" }}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: FOUC_MARKUP }}
    />
  );
}