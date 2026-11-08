export const THEME_COOKIE_NAME = "theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export const THEMES = ["light", "dark", "cosmos", "system"] as const;
export type ThemeName = (typeof THEMES)[number];

export const RESOLVED_THEMES = ["light", "dark", "cosmos"] as const;
export type ResolvedTheme = (typeof RESOLVED_THEMES)[number];

export const DEFAULT_THEME: ThemeName = "system";

/**
 * Themes that map to the "dark color-scheme" for browser UI hints
 * (form controls, scrollbars). "cosmos" is a custom dark variant.
 */
export const DARK_THEMES: ReadonlySet<ResolvedTheme> = new Set([
  "dark",
  "cosmos",
]);

/**
 * Each theme's `--background` from `globals.css`, as hex. Drives the single
 * `<meta name="theme-color">` (status bar of the installed app, address bar
 * of mobile Chrome), so the bar continues the header - `.header-bg` paints
 * `var(--background)`. Follows the theme picked in the app, not the OS.
 * `themeColors.test.ts` fails if these drift from the stylesheet.
 */
export const THEME_COLORS: Readonly<Record<ResolvedTheme, string>> = {
  light: "#e7ecf0",
  dark: "#070707",
  cosmos: "#040511",
};

/** Brand tile color: the installed app's splash and icon background. */
export const SPLASH_COLOR = "#0a0b1e";

export function isThemeName(value: unknown): value is ThemeName {
  return (
    typeof value === "string" &&
    (THEMES as readonly string[]).includes(value)
  );
}

export function asThemeName(value: unknown): ThemeName {
  return isThemeName(value) ? value : DEFAULT_THEME;
}

/**
 * Resolves a theme value (which may be "system") to a concrete class name
 * that goes on `<html>`. When called server-side without a system hint, we
 * default to "light" - the inline media-query fallback in `globals.css`
 * paints dark for system-dark users before client takes over.
 */
export function resolveTheme(
  theme: ThemeName,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (theme === "system") return systemPrefersDark ? "dark" : "light";
  return theme;
}