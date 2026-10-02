"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
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
 * How many logos the row shows, and how big they are, is decided in CSS -
 * `.brand-strip-row` in globals.css, with container queries on the row's own
 * width. See that block for the arithmetic behind the breakpoints.
 *
 * It used to be a fixed 3 / 4 / 6 / 7 by VIEWPORT width, spread across the full
 * measure with `justify-between`. Measured on the real page that left gaps of
 * 123px at 480px wide, 195px at 900px and 229px at 1000px - four logos adrift
 * in a band with room for eleven - because the viewport is the wrong input:
 * from `lg` up the label sits inside the row and takes ~230px of it, and that
 * width is translated, so it is not even the same per locale.
 *
 * Deriving it in JS instead (observe the row, solve for the count) fixed the
 * spacing but not the SKELETON: the server cannot measure a viewport, so every
 * cold load painted one guess - four small logos - and then jumped to the real
 * row once JS had caught up. CSS has the width on the first paint, so the
 * server-rendered row IS the final row, at every width, with no correction.
 *
 * What is left for JS is the rotation, and the only thing it needs from the
 * layout is how many slots are currently on screen - which it READS BACK from
 * the DOM rather than recomputing, so CSS stays the single source of truth.
 */

/**
 * Slots rendered into the DOM. CSS reveals as many as fit and hides the rest,
 * so this is the ceiling on how many can ever be on screen at once - without
 * one, a full 24-brand catalogue would turn a wide band into a sheet of small
 * stickers. Must stay in step with the last container query in
 * `.brand-strip-row`.
 */
const MAX_VISIBLE = 10;

/** How long a slot holds before the next one changes. */
const SWAP_MS = 3600;

/** Must match `.brand-swap-*` in globals.css: the outgoing logo is unmounted
 *  when its animation ends, not before. */
const SWAP_FADE_MS = 520;

/**
 * The chip fills the slot box, which `.brand-strip-slot` has already sized from
 * the grid column it sits in. See `BrandLogo`'s `size` prop for the string
 * form - it is what lets a logo be sized by CSS instead of by the caller.
 */
const LOGO_SIZE = "100%";

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

  /*
    The vignette belongs INSIDE each layer, not beside them.

    `.brand-swap-in` carries an animation with `fill-mode: both`, and an
    animation creates a stacking context - which trapped `<BrandLogo>`'s
    loading shimmer (`z-10`) inside that layer, letting a sibling vignette
    paint over it. The collage tiles and department cards have no such
    animation, so there the shimmer won over the vignette, and the same
    placeholder ended up shaded in one place and clean in another. Keeping the
    vignette in the same stacking context as the shimmer makes the `z-10` win
    everywhere: the wash appears with the logo, never over its placeholder.
  */
  const renderLogo = (b: BrandListItem) => (
    <span className="relative block">
      <BrandLogo
        src={b.logoUrl}
        srcDark={b.logoUrlDark}
        backdrop={b.logoBackdrop}
        backdropDark={b.logoBackdropDark}
        name={getBrandName(b, locale)}
        size={LOGO_SIZE}
      />
      {/* Same theme-coloured wash the category collage, the department cards
          and the product cards carry, so every image surface on the page rests
          and clears the same way. */}
      <span aria-hidden className="theme-vignette rounded-sm" />
    </span>
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
    </span>
  );

  /* Two classes, two jobs.

     `.brand-strip-slot` is the slot's BOX: it takes its width from the grid
     column (capped at `--brand-strip-logo-max`) and centres itself in it. That
     width has to sit on THIS element rather than deeper in, because everything
     inside - both swap layers and the vignette - is `absolute inset-0` and
     would otherwise stretch across the whole column instead of hugging the
     logo.

     `.brand-logo-muted` desaturates and dims at rest and clears on hover, on
     the touch gesture and on keyboard focus. It is a CSS class rather than
     Tailwind utilities for one reason: it aims the filter at the `img`, so
     `<BrandLogo>`'s loading shimmer keeps the same colour as every other
     shimmer in the app instead of being dimmed along with it. */
  const shell = "brand-strip-slot brand-logo-muted block";

  if (!slug) return <span className={shell}>{logo}</span>;

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
  // How many slots are ON SCREEN right now. CSS decides that (see the comment
  // at the top of this file), so this reads the answer back out of the DOM
  // instead of recomputing it - a second copy of the breakpoint arithmetic in
  // JS is exactly the kind of thing that drifts from the stylesheet.
  //
  // A ref, not state: nothing in the render depends on it. Only the rotation
  // interval reads it, and it must see the current value rather than the one
  // captured when the interval was created.
  const rowRef = useRef<HTMLUListElement>(null);
  const visibleRef = useRef(0);
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const recount = () => {
      // A hidden slot is `display: none`, so it has no box.
      visibleRef.current = [...row.children].filter(
        (slot) => slot.getBoundingClientRect().width > 0,
      ).length;
    };
    recount();
    // Observing the row catches both a viewport resize and the container query
    // flipping a slot on or off, since the latter only ever happens because the
    // former changed the row's width.
    const observer = new ResizeObserver(recount);
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  // Slots in the DOM. Fixed, server-rendered, and the same on every client:
  // which of them are visible is CSS's business, not React's.
  const slotCount = Math.min(MAX_VISIBLE, brands.length);
  const [shown, setShown] = useState<number[]>(() =>
    Array.from({ length: slotCount }, (_, i) => i),
  );
  // Next slot to change and next brand to bring in, both advancing round-robin
  // so the rotation walks the whole list rather than reshuffling the same few.
  const cursor = useRef({ slot: 0, brand: slotCount });

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
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const id = setInterval(() => {
      const visible = visibleRef.current;
      // Nothing held back, so nothing to rotate to. Checked per tick rather
      // than per mount because the visible count moves with the window.
      if (visible === 0 || brands.length <= visible) return;

      setShown((prev) => {
        let slot = cursor.current.slot % visible;
        // Step over the slot the user is pointing at. If every slot is
        // somehow engaged, skip this tick rather than swap under them.
        for (
          let guard = 0;
          guard < visible && slot === engagedSlotRef.current;
          guard++
        ) {
          slot = (slot + 1) % visible;
        }
        if (slot === engagedSlotRef.current) return prev;

        // Only the VISIBLE slots decide what counts as already on screen - a
        // brand parked in a hidden slot is fair game to bring in.
        let brand = cursor.current.brand % brands.length;
        for (
          let guard = 0;
          guard < brands.length && prev.slice(0, visible).includes(brand);
          guard++
        ) {
          brand = (brand + 1) % brands.length;
        }
        cursor.current = { slot: slot + 1, brand: brand + 1 };

        const next = [...prev];
        // If the brand coming in was parked in a hidden slot, SWAP rather than
        // copy: leaving it in both would show it twice the moment the window
        // widens far enough to reveal that slot.
        const parked = next.indexOf(brand);
        const outgoing = next[slot];
        next[slot] = brand;
        if (parked !== -1 && parked !== slot) next[parked] = outgoing;
        return next;
      });
    }, SWAP_MS);

    return () => clearInterval(id);
  }, [brands.length]);

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

          {/* The container the row's queries read - see `.brand-strip-row`
              in globals.css. It has to be a WRAPPER rather than the `<ul>`
              itself, because a container query cannot style the element that
              declares the container. `min-w-0` keeps this width a function of
              the band, never of the logos inside it, which is what makes the
              queries read the space actually available. */}
          <div className="brand-strip-container w-full min-w-0 flex-1">
            <ul className="brand-strip-row" ref={rowRef}>
              {shown.map((brandIndex, slot) => {
                const brand = brands[brandIndex % brands.length];
                if (!brand) return null;
                return (
                  // Keyed by SLOT, not by brand: the slot is the thing that
                  // persists, so React swaps the logo inside it rather than
                  // unmounting and remounting the row item.
                  <li key={slot}>
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
      </div>
    </section>
  );
}
