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