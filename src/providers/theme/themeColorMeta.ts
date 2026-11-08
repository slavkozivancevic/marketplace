/**
 * Points the document's single `<meta name="theme-color">` at `color`,
 * creating it if missing and dropping any `media` attribute. The tag is owned
 * here, not by Next's `viewport.themeColor` (deliberately unset): a media-keyed
 * pair follows the OS color scheme, so OS light + app dark painted a light
 * status bar on the installed app.
 *
 * Self-contained on purpose - `FoucScript` inlines its source text, so it must
 * not reference anything outside its own body.
 */
export function setThemeColorMeta(color: string): void {
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  let meta = metas[0] as HTMLMetaElement | undefined;
  for (let i = 1; i < metas.length; i++) metas[i].remove();
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.removeAttribute("media");
  meta.content = color;
}
