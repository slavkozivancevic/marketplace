import { BrandMark } from "./brand-mark";
import { BrandWordmark } from "./brand-wordmark";
import { cn } from "@/lib/utils";

/**
 * The MarketVerse lockup: the brand mark in its chip, the two-tone wordmark,
 * and the comet that belongs to both.
 *
 * Header, home hero and the full-page loader used to assemble this
 * themselves, which is why they drifted apart - three sizes, three hover
 * treatments, and a loader whose spinning ring had nothing to do with the
 * brand. They now share one component and one comet: the mark IS a comet, so
 * the motion is the logo animating itself rather than a generic spinner or
 * shimmer.
 *
 * Effects (all defined in globals.css as plain classes, never Tailwind
 * utilities - see the note there about `localeSwitchOverlay.ts`):
 *   - `sweep`  one pass across the lockup on mount (hero)
 *   - `hover`  the same pass, but only while an ancestor `.group` is hovered
 *              (header)
 *   - `orbit`  the comet circling the mark, looping (loader)
 *   - `none`   static
 *
 * No hooks and no intl: the loader renders this while Clerk and next-intl are
 * both still unavailable, so this has to stay a plain Server Component.
 */

type LockupSize = "header" | "hero" | "loader";
type LockupEffect = "none" | "sweep" | "hover" | "orbit";

const SIZES: Record<
  LockupSize,
  {
    chip: string;
    mark: string;
    word: string;
    gap: string;
    truncate: boolean;
  }
> = {
  header: {
    chip: "h-9 w-9",
    mark: "h-9 w-9",
    word: "text-lg font-bold tracking-tight leading-tight",
    gap: "gap-2.5",
    // The header logo shares its rail with the nav and the account controls,
    // so it has to be allowed to clip rather than push them off-screen.
    truncate: true,
  },
  hero: {
    // Fluid, not stepped: "MarketVerse" is eleven characters of extrabold
    // display type beside a chip, and at a fixed `text-4xl` that pair is wider
    // than a 320px screen minus its gutters - it would either ellipsize the
    // brand name or widen the page. The clamp floor is sized so the lockup
    // still fits at the narrowest width we support.
    chip: "h-10 w-10 sm:h-14 sm:w-14 lg:h-16 lg:w-16",
    mark: "h-10 w-10 sm:h-14 sm:w-14 lg:h-16 lg:w-16",
    // Two clamps, because the lockup lives in two different boxes. Below `lg`
    // it has the full measure to itself and can scale with the viewport. From
    // `lg` it sits in a grid column roughly half that wide, so a viewport-sized
    // clamp overflows the column and slides under the mosaic beside it - the
    // second clamp is sized against the COLUMN, not the window.
    word:
      "text-[clamp(1.75rem,8.5vw,3.75rem)] lg:text-[clamp(2.25rem,4vw,3.5rem)] font-extrabold tracking-tight leading-none",
    gap: "gap-3 sm:gap-4",
    truncate: false,
  },
  loader: {
    chip: "h-12 w-12",
    mark: "h-12 w-12",
    word:
      "text-sm font-semibold uppercase tracking-[0.3em] pl-[0.3em] text-muted-foreground",
    gap: "gap-5",
    truncate: false,
  },
};

function BrandChip({ size, orbit }: { size: LockupSize; orbit: boolean }) {
  const s = SIZES[size];

  // No `.brand-tile` behind the mark, at any size. That chip is deliberately
  // theme-DEPENDENT - transparent on light (the ink mark carries itself), a
  // dark tile with a hairline border on dark and cosmos - so the logo wore a
  // visible rounded box in two themes out of three and nothing in the third.
  // The `bm-*` classes already recolour the mark per theme, so bare is both
  // consistent and lighter.
  const chip = (
    <span className={cn("flex shrink-0 items-center justify-center", s.chip)}>
      <BrandMark className={s.mark} />
    </span>
  );

  if (!orbit) return chip;

  // The comet needs room outside the chip, so the chip is centred inside its
  // own square orbit track.
  return (
    <span className="relative block h-24 w-24">
      <span className="brand-orbit-track" />
      <span className="brand-orbit-comet" />
      <span className="absolute inset-0 grid place-items-center">{chip}</span>
    </span>
  );
}

export function BrandLockup({
  size = "header",
  effect = "none",
  orientation = "horizontal",
  tagline,
  className,
}: {
  size?: LockupSize;
  effect?: LockupEffect;
  /** The loader stacks the mark above the wordmark; everything else is a row. */
  orientation?: "horizontal" | "vertical";
  /** Small line under the wordmark (the headers' strapline). */
  tagline?: React.ReactNode;
  className?: string;
}) {
  const s = SIZES[size];
  const sweeping = effect === "sweep" || effect === "hover";
  const vertical = orientation === "vertical";

  return (
    <span
      className={cn(
        "relative flex min-w-0",
        vertical ? "flex-col items-center" : "flex-row items-center",
        s.gap,
        className,
      )}
    >
      <BrandChip size={size} orbit={effect === "orbit"} />

      <span
        className={cn(
          "relative flex min-w-0 flex-col",
          vertical && "items-center gap-4",
        )}
      >
        <span className="relative inline-flex flex-col min-w-0">
          {/* The aura is its own positioned layer with the text lifted above
              it, rather than a `z-index: -1` pseudo-element - that would sit
              behind whatever background the surrounding section paints, and
              the hero paints several. Hero only: at the header's and loader's
              text sizes it just smudges the wordmark. */}
          {size === "hero" && <span aria-hidden className="brand-aura" />}
          <span className={cn("relative", s.truncate && "truncate", s.word)}>
            <BrandWordmark />
          </span>
          {tagline}
        </span>
      </span>

      {sweeping && (
        <span
          aria-hidden
          className={cn(
            "brand-sweep",
            effect === "sweep" ? "brand-sweep-auto" : "brand-sweep-hover",
          )}
        />
      )}
    </span>
  );
}
