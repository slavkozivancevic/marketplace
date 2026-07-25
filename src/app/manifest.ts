import type { MetadataRoute } from "next";

/**
 * Serves `/manifest.webmanifest` (Next's file convention maps this filename
 * to that path automatically). There's no separate mobile app, so this is
 * what makes "Add to Home Screen" produce a proper standalone icon + splash
 * instead of a bare browser bookmark. `proxy.ts` already excludes this path
 * from locale-prefixing (`LOCALE_AGNOSTIC_FILES`) in anticipation of it.
 *
 * Icons reuse existing generated brand assets (see
 * scripts/generate-brand-assets.mjs) rather than new ones - `stripe-icon.png`
 * is a 512x512 rounded dark tile, already used as the Stripe Express icon, so
 * it doubles as a reasonable non-maskable home-screen icon. A dedicated
 * maskable icon (safe-zone padding for round/squircle OS masks) would be a
 * follow-up if the install icon needs to look sharper.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MarketVerse",
    short_name: "MarketVerse",
    description: "MarketVerse - modern commerce, built for scale",
    start_url: "/",
    display: "standalone",
    background_color: "#f0eff5",
    theme_color: "#f0eff5",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
      { src: "/brand/stripe-icon.png", type: "image/png", sizes: "512x512" },
    ],
  };
}
