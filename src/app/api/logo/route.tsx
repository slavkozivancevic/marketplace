import { ImageResponse } from "next/og";

/**
 * Square 512x512 brand logo for the `Organization` JSON-LD `logo` field.
 * Google prefers a real logo (>=112px, square) over a favicon. Renders the
 * MarketVerse mark (comet + shopping bag + star field) on the dark brand
 * tile - same paths as `BrandMark` and `scripts/generate-brand-assets.mjs`.
 * Cached hard since it never changes.
 */
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="tw" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#f2eee7" stop-opacity="0"/>
      <stop offset=".55" stop-color="#c9c7d0" stop-opacity=".5"/>
      <stop offset="1" stop-color="#f2eee7"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" fill="#0a0b1e"/>
  <g transform="translate(5.76,5.76) scale(0.82)">
    <path d="M3 7 C20 8 34 12 44.2 17.8 L43.6 23.3 C32 18.5 17 12 3 7 Z" fill="url(#tw)"/>
    <circle cx="47" cy="20.5" r="4.2" fill="#f2eee7"/>
    <path d="M20 30 L44 30 L47.3 46.8 Q48 50 44.5 50 L19.5 50 Q16 50 16.7 46.8 Z" fill="#0a0b1e" stroke="#f2eee7" stroke-width="1.5"/>
    <path d="M27 30 v-2.8 a5 5 0 0 1 10 0 V30" fill="none" stroke="#f2eee7" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M10 11.2 Q10.7 13.3 12.8 14 Q10.7 14.7 10 16.8 Q9.3 14.7 7.2 14 Q9.3 13.3 10 11.2 Z" fill="#f2eee7"/>
    <path d="M55 10 Q55.5 11.5 57 12 Q55.5 12.5 55 14 Q54.5 12.5 53 12 Q54.5 11.5 55 10 Z" fill="#c9c7d0" opacity=".9"/>
    <path d="M7 35.6 Q7.6 37.4 9.4 38 Q7.6 38.6 7 40.4 Q6.4 38.6 4.6 38 Q6.4 37.4 7 35.6 Z" fill="#f2eee7" opacity=".85"/>
    <path d="M57 40.2 Q57.45 41.55 58.8 42 Q57.45 42.45 57 43.8 Q56.55 42.45 55.2 42 Q56.55 41.55 57 40.2 Z" fill="#a5a3b0" opacity=".85"/>
    <path d="M12 53.4 Q12.4 54.6 13.6 55 Q12.4 55.4 12 56.6 Q11.6 55.4 10.4 55 Q11.6 54.6 12 53.4 Z" fill="#c9c7d0" opacity=".8"/>
    <circle cx="52" cy="31" r="0.9" fill="#f2eee7" opacity=".55"/>
    <circle cx="34" cy="57.5" r="1" fill="#a5a3b0" opacity=".6"/>
  </g>
</svg>`;

export function GET() {
  const src = `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`;
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} width={512} height={512} alt="" />
    ),
    {
      width: 512,
      height: 512,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
