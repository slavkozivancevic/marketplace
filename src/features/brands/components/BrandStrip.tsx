"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useTouchHover, touchActiveAttr } from "@/hooks/useTouchHover";
import { BrandLogo } from "./BrandLogo";
import { getBrandName, getBrandSlug } from "../utils/translations";
import type { BrandListItem } from "../db/brands";

/**
 * A band of real brand logos under the hero.
 *
 * The familiar "logos of companies we work with" strip, except these are not
 * decoration: they are the brands actually carried in this catalogue, each one
 * a link into its own brand page. It answers the first question a visitor has
 * about a marketplace they have never heard of - what is actually sold here.
 *
 * Logos come through `<BrandLogo>`, which picks each asset's tile from the
 * asset's OWN luminance rather than from the active theme, so a white logo and
 * a black one both stay legible on light, dark and cosmos alike.
 */

/**
 * Visible slots per breakpoint. These MUST match the grid's column counts
 * below, because the grid is what guarantees a single row: a `flex-wrap` strip
 * put whatever did not fit onto a second line, centred on its own, which is
 * how eight logos ended up as a row of seven and an orphan.
 */
const SLOTS_XL = 7;

/**
 * The widest arrangement is what the rotation cycles over. It is deliberately
 * SMALLER than the pool the page fetches (`BRAND_STRIP_LIMIT`): with eight
 * qualifying brands and eight slots, every brand was already on screen, so the
 * "rotate so each one gets a turn" effect had nothing to rotate to and its
 * interval never even started.
 */
const SLOTS = SLOTS_XL;

/** How long a slot holds before the next one changes. */
const SWAP_MS = 3600;

/** Must match `.brand-swap-*` in globals.css: the outgoing logo is unmounted
 *  when its animation ends, not before. */
const SWAP_FADE_MS = 520;

/** Slots beyond the narrow column counts are hidden, never wrapped. */
const SLOT_VISIBILITY = [
  "flex",
  "flex",
  "flex",
  "hidden sm:flex",
  "hidden lg:flex",
  "hidden lg:flex",
  "hidden xl:flex",
];

function BrandSlot({
  brand,
  slot,
  onEngagedChange,
}: {
  brand: BrandListItem;
  slot: number;
  /** Tells the strip which slot is under a cursor or a finger right now. */
  onEngagedChange: (slot: number, engaged: boolean) => void;
}) {
  const locale = useLocale();
  const [hovered, setHovered] = useState(false);
  // Touch has no hover, so a touch that turns into a small swipe stands in for
  // the cursor - the same gesture the product grid, the department cards and
  // the hero collage use. At rest a phone shows exactly what a desktop shows,
  // desaturated and dimmed.
  const { active, containerRef, touchProps } = useTouchHover();

  // A slot the user is pointing at must not be swapped out from under them -
  // reaching for a logo and having it become a different brand on the last
  // frame is how a click lands on the wrong page. Hover and the touch gesture
  // both count as "engaged".
  const engaged = hovered || active;
  useEffect(() => {
    onEngagedChange(slot, engaged);
  }, [slot, engaged, onEngagedChange]);

  const name = getBrandName(brand, locale);
  const slug = getBrandSlug(brand, locale);

  // The logo this slot is leaving behind, kept mounted just long enough to
  // animate out over the one arriving. Without it the swap was instant: one
  // frame Nike, the next Bosch.
  const [outgoing, setOutgoing] = useState<BrandListItem | null>(null);
  const shownBrandRef = useRef(brand);
  useEffect(() => {
    if (shownBrandRef.current.id === brand.id) return;
    setOutgoing(shownBrandRef.current);
    shownBrandRef.current = brand;
    const t = setTimeout(() => setOutgoing(null), SWAP_FADE_MS);
    return () => clearTimeout(t);
  }, [brand]);

  const renderLogo = (b: BrandListItem) => (
    <BrandLogo
      src={b.logoUrl}
      srcDark={b.logoUrlDark}
      backdrop={b.logoBackdrop}
      backdropDark={b.logoBackdropDark}
      name={getBrandName(b, locale)}
      size={64}
    />
  );

  const logo = (
    // `relative` with the outgoing layer absolutely on top: both occupy the
    // same box, so the row never reflows while a slot changes.
    <span className="relative block">
      {outgoing && (
        <span aria-hidden className="brand-swap-out absolute inset-0">
          {renderLogo(outgoing)}
        </span>
      )}
      <span key={brand.id} className="brand-swap-in block">
        {renderLogo(brand)}
      </span>
      {/* Same theme-coloured wash the category collage, the department cards
          and the product cards carry, so every image surface on the page rests
          and clears the same way. Sits above both swap layers. */}
      <span aria-hidden className="theme-vignette rounded-sm" />
    </span>
  );

  /* `.brand-logo-muted` (globals.css) desaturates and dims at rest and clears
     on hover, on the touch gesture and on keyboard focus. It is a CSS class
     rather than Tailwind utilities here for one reason: it aims the filter at
     the `img`, so `<BrandLogo>`'s loading shimmer keeps the same colour as
     every other shimmer in the app instead of being dimmed along with it. */
  const shell = "brand-logo-muted block";

  if (!slug) return <span className="brand-logo-muted block">{logo}</span>;

  return (
    <Link
      href={{ pathname: "/brands/[slug]", params: { slug } }}
      aria-label={name}
      ref={containerRef}
      {...touchProps}
      {...touchActiveAttr(active)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={shell}
    >
      {logo}
    </Link>
  );
}

export function BrandStrip({
  brands,
  label,
}: {
  brands: BrandListItem[];
  label: string;
}) {
  const visible = Math.min(SLOTS, brands.length);

  const [shown, setShown] = useState<number[]>(() =>
    Array.from({ length: visible }, (_, i) => i),
  );
  // Next slot to change and next brand to bring in, both advancing round-robin
  // so the rotation walks the whole list rather than reshuffling the same few.
  const cursor = useRef({ slot: 0, brand: visible });

  // Which slot is under a cursor or a finger, read by the interval through a
  // ref so it always sees the current value rather than the one captured when
  // the interval was created.
  const [engagedSlot, setEngagedSlot] = useState<number | null>(null);
  const engagedSlotRef = useRef<number | null>(null);
  useEffect(() => {
    engagedSlotRef.current = engagedSlot;
  }, [engagedSlot]);

  const handleEngagedChange = useCallback((slot: number, engaged: boolean) => {
    setEngagedSlot((prev) => (engaged ? slot : prev === slot ? null : prev));
  }, []);

  useEffect(() => {
    // Nothing held back, so nothing to rotate to.
    if (brands.length <= visible) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const id = setInterval(() => {
      setShown((prev) => {
        let slot = cursor.current.slot % prev.length;
        // Step over the slot the user is pointing at. If every slot is
        // somehow engaged, skip this tick rather than swap under them.
        for (
          let guard = 0;
          guard < prev.length && slot === engagedSlotRef.current;
          guard++
        ) {
          slot = (slot + 1) % prev.length;
        }
        if (slot === engagedSlotRef.current) return prev;
        let brand = cursor.current.brand % brands.length;
        // Never show the same brand twice in the row at once.
        for (
          let guard = 0;
          guard < brands.length && prev.includes(brand);
          guard++
        ) {
          brand = (brand + 1) % brands.length;
        }
        cursor.current = { slot: slot + 1, brand: brand + 1 };
        const next = [...prev];
        next[slot] = brand;
        return next;
      });
    }, SWAP_MS);

    return () => clearInterval(id);
  }, [brands.length, visible]);

  if (brands.length === 0) return null;

  // `.band-rule`, not `border-y border-border`: see globals.css. The border
  // token is sized for a card edge against a card surface and disappears when
  // drawn across the open page background on the light theme; the rule there
  // mixes from `--foreground` so it carries the same weight on all three.
  return (
    <section className="band-rule py-9">
      {/* Same measure and gutters as the hero collage and the department row
          (`max-w-7xl`), so the three bands line up down the left and right
          edges instead of this one running wider than everything else. */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-5 lg:flex-row lg:gap-10">
          <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>

          {/*
            `flex-nowrap` with `justify-between`, not a wrapping row and not a
            centred grid.

            - No wrap: the original `flex-wrap` dropped whatever did not fit
              onto a second line, centred on its own, which is how eight logos
              became a row of seven and an orphan. How many are shown is
              decided per breakpoint by SLOT_VISIBILITY, never by wrapping.
            - `justify-between`: the first logo sits on the left edge and the
              last on the right, so the row spans the full measure. A grid with
              `justify-items-center` distributed them evenly but inset each one
              inside its own cell, which left the row looking short of both
              ends.
            - `min-w-0` because this sits inside a flex row and must never be
              what widens the shell.
          */}
          <ul className="flex w-full min-w-0 flex-1 flex-nowrap items-center justify-between gap-x-4">
            {shown.map((brandIndex, slot) => {
              const brand = brands[brandIndex % brands.length];
              if (!brand) return null;
              return (
                // Keyed by SLOT, not by brand: the slot is the thing that
                // persists, so React swaps the logo inside it rather than
                // unmounting and remounting the row item.
                <li
                  key={slot}
                  className={cn(
                    "shrink-0 items-center justify-center",
                    SLOT_VISIBILITY[slot] ?? "flex",
                  )}
                >
                  <BrandSlot
                    brand={brand}
                    slot={slot}
                    onEngagedChange={handleEngagedChange}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
