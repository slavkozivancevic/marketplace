import type { MetadataRoute } from "next";
import { SPLASH_COLOR } from "@/providers/theme/constants";

/**
 * Serves `/manifest.webmanifest` (Next's file convention maps this filename
 * to that path automatically). There's no separate mobile app, so this is
 * what makes "Add to Home Screen" / "Install app" produce a proper standalone
 * icon + splash instead of a bare browser bookmark. `proxy.ts` excludes this
 * path from locale-prefixing (`LOCALE_AGNOSTIC_FILES`).
 *
 * Icons come from scripts/generate-brand-assets.mjs: a rounded dark tile for
 * `any` and a full-bleed tile with the mark inside the safe zone for
 * `maskable`. `icon.svg` is deliberately NOT listed: Android rasterizes it
 * without `prefers-color-scheme: dark`, so it got the light-surface variant -
 * a dark bag on a transparent canvas, i.e. a dark bag on a dark launcher.
 *
 * The splash Android draws at launch (`background_color` + icon) is baked in
 * at install time, so it cannot follow the theme picked in the app and cannot
 * animate. It uses the icon tile's color, so it reads as the icon enlarged;
 * the animated, theme-aware `AppLoader` takes over right after. Once a page
 * loads, the status bar follows the app theme through the `theme-color` meta
 * that `FoucScript` / `ThemeProvider` keep in sync - `theme_color` here only
 * covers the splash.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MarketVerse",
    short_name: "MarketVerse",
    description: "MarketVerse - modern commerce, built for scale",
    start_url: "/",
    display: "standalone",
    background_color: SPLASH_COLOR,
    theme_color: SPLASH_COLOR,
    icons: [
      { src: "/brand/app-icon-192.png", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/brand/app-icon-512.png", type: "image/png", sizes: "512x512", purpose: "any" },
      {
        src: "/brand/app-icon-maskable-192.png",
        type: "image/png",
        sizes: "192x192",
        purpose: "maskable",
      },
      {
        src: "/brand/app-icon-maskable-512.png",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
