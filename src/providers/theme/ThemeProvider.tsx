"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  asThemeName,
  DARK_THEMES,
  DEFAULT_THEME,
  RESOLVED_THEMES,
  resolveTheme,
  THEME_COOKIE_MAX_AGE,
  THEME_COOKIE_NAME,
  type ResolvedTheme,
  type ThemeName,
} from "./constants";

type ThemeContextValue = {
  /** Stored preference (may be "system"). */
  theme: ThemeName;
  /** Concrete resolved theme actually applied to `<html>` ("light"|"dark"|"cosmos"). */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeName) => void;
  themes: readonly ThemeName[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(SYSTEM_DARK_QUERY).matches;
}

function readCookieTheme(): ThemeName {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${THEME_COOKIE_NAME}=([^;]+)`),
  );
  return asThemeName(match?.[1]);
}

function writeCookieTheme(value: ThemeName) {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_COOKIE_NAME}=${value}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}

function applyThemeToHtml(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  RESOLVED_THEMES.forEach((t) => html.classList.remove(t));
  html.classList.add(resolved);
  html.style.colorScheme = DARK_THEMES.has(resolved) ? "dark" : "light";
}

/**
 * Theme provider with no inline FOUC script. The user's saved preference
 * lives in the `theme` cookie (also mirrored into the React context here).
 * Initial theme is read from `document.cookie` during the first render and
 * applied via `useLayoutEffect` BEFORE the browser paints anything user-
 * visible, which prevents flash for most navigations.
 *
 * Why not an inline script: `next-themes` renders a `<script>` inside its
 * component tree, which trips React 19's "script inside a component"
 * warning every time the layout re-renders on a locale switch. Reading
 * the cookie server-side instead would make this layout dynamic and
 * cascade to descendant pages that previously pre-rendered statically -
 * breaking the `cacheComponents` build. The client-side read here is the
 * compromise that satisfies both constraints.
 *
 * Trade-off: a user who explicitly chose a non-system theme may see a
 * single frame of the default theme during initial SSR paint (server
 * doesn't know their cookie before the JS runs). System-preference users
 * are unaffected because `globals.css` paints dark via
 * `prefers-color-scheme` before our JS takes over.
 *
 * `useTheme()` mirrors the `next-themes` API so call sites stayed
 * mostly the same.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initializer reads cookie at first render. On server this returns
  // DEFAULT_THEME ("system"); on client it returns whatever the user picked.
  const [theme, setThemeState] = useState<ThemeName>(() => readCookieTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(readCookieTheme(), getSystemPrefersDark()),
  );

  // useLayoutEffect fires synchronously after DOM mutation but before the
  // browser paints, so the theme class lands on `<html>` ahead of any
  // visible content.
  useLayoutEffect(() => {
    const cookieTheme = readCookieTheme();
    if (cookieTheme !== theme) setThemeState(cookieTheme);
    const resolved = resolveTheme(cookieTheme, getSystemPrefersDark());
    setResolvedTheme(resolved);
    applyThemeToHtml(resolved);
    // Run only on mount - subsequent updates go through `setTheme`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track OS `prefers-color-scheme` changes while user's preference is "system".
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia(SYSTEM_DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      const next: ResolvedTheme = e.matches ? "dark" : "light";
      setResolvedTheme(next);
      applyThemeToHtml(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemeName) => {
    const safe = asThemeName(next);
    setThemeState(safe);
    writeCookieTheme(safe);
    const resolved = resolveTheme(safe, getSystemPrefersDark());
    setResolvedTheme(resolved);
    applyThemeToHtml(resolved);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      themes: ["light", "dark", "cosmos", "system"],
    }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within <ThemeProvider>");
  }
  return ctx;
}