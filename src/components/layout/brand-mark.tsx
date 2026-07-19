/**
 * MarketVerse brand mark: a comet streaking behind a paper shopping bag,
 * surrounded by a small star field. Colors are theme-driven via the `bm-*`
 * classes in globals.css: the light theme renders the inverted ink variant
 * (dark silhouette, no tile), dark/cosmos render the white-outline variant on
 * the dark brand tile (put `brand-tile` on the wrapping chip). Both tail
 * gradients ship in the defs; CSS picks the active one. Raster derivatives
 * (favicon, apple-icon, email-logo, Stripe lockups) come from
 * `scripts/generate-brand-assets.mjs`; keep them in sync when editing, along
 * with the inline copies in localeSwitchOverlay.ts and notFoundResponse.ts.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="bm-tail-w" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#f2eee7" stopOpacity="0" />
          <stop offset="0.55" stopColor="#c9c7d0" stopOpacity="0.5" />
          <stop offset="1" stopColor="#f2eee7" />
        </linearGradient>
        <linearGradient id="bm-tail-l" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0a0b1e" stopOpacity="0" />
          <stop offset="0.55" stopColor="#4a4956" stopOpacity="0.5" />
          <stop offset="1" stopColor="#0a0b1e" />
        </linearGradient>
      </defs>
      {/* comet: tail edges land on the head's rim, head drawn over the seam */}
      <path
        className="bm-tail"
        d="M3 7 C20 8 34 12 44.2 17.8 L43.6 23.3 C32 18.5 17 12 3 7 Z"
      />
      <circle className="bm-a" cx="47" cy="20.5" r="4.2" />
      {/* paper shopping bag: squat trapezoid, rounded bottom, thin handle */}
      <path
        className="bm-bag"
        d="M20 30 L44 30 L47.3 46.8 Q48 50 44.5 50 L19.5 50 Q16 50 16.7 46.8 Z"
      />
      <path
        className="bm-handle"
        d="M27 30 v-2.8 a5 5 0 0 1 10 0 V30"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* star field: five 4-point sparkles + two distant dots */}
      <path className="bm-a" d="M10 11.2 Q10.7 13.3 12.8 14 Q10.7 14.7 10 16.8 Q9.3 14.7 7.2 14 Q9.3 13.3 10 11.2 Z" />
      <path className="bm-b" d="M55 10 Q55.5 11.5 57 12 Q55.5 12.5 55 14 Q54.5 12.5 53 12 Q54.5 11.5 55 10 Z" opacity="0.9" />
      <path className="bm-a" d="M7 35.6 Q7.6 37.4 9.4 38 Q7.6 38.6 7 40.4 Q6.4 38.6 4.6 38 Q6.4 37.4 7 35.6 Z" opacity="0.85" />
      <path className="bm-c" d="M57 40.2 Q57.45 41.55 58.8 42 Q57.45 42.45 57 43.8 Q56.55 42.45 55.2 42 Q56.55 41.55 57 40.2 Z" opacity="0.85" />
      <path className="bm-b" d="M12 53.4 Q12.4 54.6 13.6 55 Q12.4 55.4 12 56.6 Q11.6 55.4 10.4 55 Q11.6 54.6 12 53.4 Z" opacity="0.8" />
      <circle className="bm-a" cx="52" cy="31" r="0.9" opacity="0.55" />
      <circle className="bm-c" cx="34" cy="57.5" r="1" opacity="0.6" />
    </svg>
  );
}
