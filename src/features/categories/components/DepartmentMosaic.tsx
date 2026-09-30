"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { RetryImage } from "@/components/RetryImage";
import { cn } from "@/lib/utils";
import type { DepartmentWithImages } from "../db/categories";
import { getCategoryName, getCategorySlug } from "../utils/translations";
import { MOSAIC_MIN_IMAGES } from "../utils/mosaic";
import { useTouchHover, touchActiveAttr } from "@/hooks/useTouchHover";

/**
 * The hero's visual: a fixed collage of real catalogue photographs - the same
 * product images the department cards further down the page are built from -
 * where one tile at a time quietly cross-fades to a different photograph.
 *
 * It runs on `getFeaturedDepartmentsWithImages()`, the data the home page
 * already fetches for that carousel, so it costs no query of its own. That
 * matters beyond performance: the hero used to be an abstract particle field,
 * i.e. a marketplace front page that showed no merchandise at all. Every tile
 * is a link into its department, so the visual is also the way in.
 *
 * NOTHING SLIDES. Earlier passes drifted the tiles in columns, and continuous
 * travel in the corner of the eye is both hard to click and genuinely
 * unpleasant to sit next to - it made people feel seasick. The collage holds
 * still; the only change is a single tile dissolving into a new image every
 * few seconds, which shows the breadth of the catalogue without ever moving
 * anything.
 */

/**
 * Distinct photographs held in the pool the tiles draw from.
 *
 * The collage shows eight at a time and swaps one at a time, so the pool is
 * what makes the rotation worth watching - and also the whole image cost of
 * the hero. An earlier version left this uncapped and put 66 tiles from ~33
 * URLs on screen; the page carried 207 images and after fifteen seconds
 * barely half had arrived.
 */
const POOL_SIZE = 24;
/** How long a tile holds before the next one starts dissolving. */
const SWAP_MS = 4200;
/** Must match the tiles' `duration-700`, so the commit lands after the fade. */
const FADE_MS = 700;

/**
 * Tile placement, given explicitly rather than left to auto-flow so both
 * arrangements fill their grid exactly, with no holes to design around.
 *
 * Two arrangements, one set of tiles: six columns from `sm` up, and a tighter
 * four-across square below that with the two smallest tiles dropped (at phone
 * width they would be thumbnails).
 */
const SLOTS = [
  {
    small: "col-start-1 row-start-1 col-span-2 row-span-2",
    wide: "sm:col-start-1 sm:row-start-1 sm:col-span-3 sm:row-span-2",
  },
  {
    small: "col-start-3 row-start-1 col-span-2 row-span-1",
    wide: "sm:col-start-4 sm:row-start-1 sm:col-span-2 sm:row-span-2",
  },
  {
    small: "col-start-3 row-start-2 col-span-2 row-span-1",
    wide: "sm:col-start-6 sm:row-start-1 sm:col-span-1 sm:row-span-1",
  },
  {
    small: "col-start-1 row-start-3 col-span-2 row-span-1",
    wide: "sm:col-start-6 sm:row-start-2 sm:col-span-1 sm:row-span-1",
  },
  {
    small: "col-start-1 row-start-4 col-span-2 row-span-1",
    wide: "sm:col-start-1 sm:row-start-3 sm:col-span-2 sm:row-span-2",
  },
  {
    small: "col-start-3 row-start-3 col-span-2 row-span-2",
    wide: "sm:col-start-3 sm:row-start-3 sm:col-span-2 sm:row-span-1",
  },
  // The last two complete the wide arrangement only; below `sm` there is no
  // room for them and the six above already tile that grid exactly.
  {
    small: "hidden",
    wide: "sm:col-start-3 sm:row-start-4 sm:col-span-2 sm:row-span-1 sm:block",
  },
  {
    small: "hidden",
    wide: "sm:col-start-5 sm:row-start-3 sm:col-span-2 sm:row-span-2 sm:block",
  },
];

type Tile = { url: string; name: string; slug: string };

/**
 * One cell. Holds two stacked image layers and cross-fades between them: the
 * incoming layer is mounted first and only fades UP once it reports `onLoad`,
 * so a slow image dissolves late instead of dissolving to an empty frame.
 */
function CollageTile({
  tile,
  slot,
  incoming,
  incomingReady,
  onIncomingLoad,
  onEngagedChange,
  className,
}: {
  tile: Tile;
  slot: number;
  incoming: Tile | null;
  incomingReady: boolean;
  onIncomingLoad: () => void;
  /** Tells the collage which tile is under a cursor or a finger right now. */
  onEngagedChange: (slot: number, engaged: boolean) => void;
  className?: string;
}) {
  const [hovered, setHovered] = useState(false);
  // Touch has no hover, so a touch that turns into a small swipe stands in for
  // the cursor - the same gesture the product grid and the department cards
  // use. At rest a phone shows exactly what a desktop shows.
  const { active: touchActive, containerRef, touchProps } = useTouchHover();

  // A tile the user is pointing at must not dissolve into a different
  // department under them - reaching for "Elektronika" and having it become
  // "Moda" on the last frame is how a click lands on the wrong page.
  const engaged = hovered || touchActive;
  useEffect(() => {
    onEngagedChange(slot, engaged);
  }, [slot, engaged, onEngagedChange]);
  /*
    `layer` is the key, NOT the url. Keying by url looks right until the
    rotation brings in a photograph the tile is already showing - then both
    layers carry the same key and React drops one of them with a duplicate-key
    error. The two layers are fixed positions in the stack; what changes is the
    `src` inside them.
  */
  const img = (layer: string, t: Tile, on: boolean, onLoad?: () => void) => (
    <RetryImage
      key={layer}
      src={t.url}
      alt=""
      fill
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 45vw, 340px"
      onLoad={onLoad}
      /* A plain opacity cross-fade read as a flat dissolve; pairing it with a
         small scale gives the swap a direction - the new photograph settles in
         from slightly larger while the old one recedes - so it looks composed
         rather than like the tile blinked. `motion-reduce` drops back to the
         bare fade. */
      className={cn(
        "object-cover transition-[opacity,transform] duration-700 ease-in-out motion-reduce:transition-opacity",
        on
          ? "opacity-100 scale-100"
          : "opacity-0 scale-[1.06] motion-reduce:scale-100",
      )}
      // The outgoing layer keeps its own placeholder off, otherwise the
      // shimmer flashes underneath mid-dissolve.
      showShimmer={!incoming}
    />
  );

  const body = (
    <>
      {img("base", tile, !incomingReady)}
      {incoming && img("incoming", incoming, incomingReady, onIncomingLoad)}

      {/* Same theme-coloured vignette the department cards carry, so the
          collage reads as the same material as the row below it. It clears on
          hover - or on the touch gesture that stands in for hover. */}
      <span
        aria-hidden
        className="theme-vignette hoverable:group-hover/tile:opacity-0 hoverable:group-hover/tile:duration-700 group-data-[touch-active=true]/tile:opacity-0 group-data-[touch-active=true]/tile:duration-700"
      />

      {/*
        Department name: hidden until the tile is engaged, on EVERY device.

        This used to be gated on `hoverable:` and so sat permanently visible
        on a phone, which made touch look nothing like desktop - the opposite
        of what it should do. The touch path now drives the exact same classes
        through `data-touch-active`, so the two inputs cannot drift into two
        different designs.
      */}
      <span className="absolute inset-x-0 bottom-0 translate-y-full bg-linear-to-t from-black/85 via-black/45 to-transparent px-2 pb-1.5 pt-7 text-center text-white opacity-0 transition-all duration-300 hoverable:group-hover/tile:translate-y-0 hoverable:group-hover/tile:opacity-100 group-data-[touch-active=true]/tile:translate-y-0 group-data-[touch-active=true]/tile:opacity-100">
        {/*
          The name should FIT, and only fall back to an ellipsis when it
          genuinely cannot. `line-clamp-2` gives it a second line before
          truncating (one line cut "Zdravlje i lepota" in half on the small
          tiles), the type is small and tightly leaded, `text-balance` splits
          the two lines evenly rather than leaving one word alone on the
          second, and `hyphens-auto` lets a single long word break instead of
          forcing the clamp.
        */}
        <span className="line-clamp-2 hyphens-auto text-balance text-[11px] font-semibold leading-tight sm:text-xs">
          {tile.name}
        </span>
      </span>
    </>
  );

  /*
    The lift rides the same pair of triggers as everything else on the tile:
    `hover:` for a real pointer, `data-[touch-active]` for the swipe that
    stands in for it. A bare `hover:` alone would latch on a touch screen after
    a tap and leave the tile raised until something else was touched.
  */
  const shell = cn(
    "group/tile relative block overflow-hidden rounded-xl border border-border/50 bg-card",
    "transition-transform duration-300 ease-out",
    "hoverable:hover:z-10 hoverable:hover:scale-[1.03] data-[touch-active=true]:z-10 data-[touch-active=true]:scale-[1.03] focus-visible:z-10 focus-visible:scale-[1.03]",
    className,
  );

  // A department with no resolvable slug has nowhere to link to; it still
  // shows its photograph rather than leaving a hole in the collage.
  if (!tile.slug) {
    return (
      <span aria-hidden className={shell}>
        {body}
      </span>
    );
  }

  return (
    <Link
      href={{ pathname: "/categories/[slug]", params: { slug: tile.slug } }}
      ref={containerRef}
      {...touchProps}
      {...touchActiveAttr(touchActive)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={shell}
      aria-label={tile.name}
    >
      {body}
    </Link>
  );
}

export function DepartmentMosaic({
  departments,
  className,
}: {
  departments: DepartmentWithImages[];
  className?: string;
}) {
  const locale = useLocale();

  const pool = useMemo<Tile[]>(() => {
    const all: Tile[] = departments.flatMap((dept) => {
      const name = getCategoryName(dept, locale);
      const slug = getCategorySlug(dept, locale);
      return dept.productImages.map((url) => ({ url, name, slug }));
    });

    // One image per department first, then a second from each, and so on - so
    // the pool spreads across departments instead of filling up with three
    // photographs of the same one.
    // Deduplicated by url first: two departments can share a photograph, and a
    // pool holding the same image twice makes the rotation look like it
    // stuttered when both copies land on screen.
    const seen = new Set<string>();
    const byDepartment = new Map<string, Tile[]>();
    for (const tile of all) {
      if (seen.has(tile.url)) continue;
      seen.add(tile.url);
      const bucket = byDepartment.get(tile.slug || tile.name);
      if (bucket) bucket.push(tile);
      else byDepartment.set(tile.slug || tile.name, [tile]);
    }
    const buckets = [...byDepartment.values()];
    const picked: Tile[] = [];
    for (let round = 0; picked.length < POOL_SIZE; round++) {
      const before = picked.length;
      for (const bucket of buckets) {
        if (picked.length >= POOL_SIZE) break;
        if (bucket[round]) picked.push(bucket[round]);
      }
      if (picked.length === before) break; // every bucket exhausted
    }
    return picked;
  }, [departments, locale]);

  // Which pool entry each of the eight cells is showing, and which one is
  // dissolving in over it.
  const [shown, setShown] = useState<number[]>(() =>
    SLOTS.map((_, i) => i % Math.max(pool.length, 1)),
  );
  const [pending, setPending] = useState<{ slot: number; index: number } | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  // Next pool entry to bring in, and next cell to bring it into. Both advance
  // round-robin so every photograph gets its turn and no cell is left out.
  const cursor = useRef({ slot: 0, pool: SLOTS.length });

  // Which tile is under a cursor or a finger, read by the interval through a
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
  // The interval closes over its first render, so it reads what is on screen
  // through a ref rather than through stale state. Synced in an effect, not
  // during render - a render can be thrown away and re-run, and a ref written
  // on the way through would keep the discarded value.
  const shownRef = useRef(shown);
  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  useEffect(() => {
    // Nothing to rotate between, and nothing to rotate for someone who asked
    // the system to stop animating things.
    if (pool.length <= SLOTS.length) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const id = setInterval(() => {
      setPending((current) => {
        if (current) return current; // a dissolve is still in flight
        let slot = cursor.current.slot % SLOTS.length;
        // Step over the tile the user is pointing at. If every tile is
        // somehow engaged, skip this tick rather than swap under them.
        for (
          let guard = 0;
          guard < SLOTS.length && slot === engagedSlotRef.current;
          guard++
        ) {
          slot = (slot + 1) % SLOTS.length;
        }
        if (slot === engagedSlotRef.current) return null;
        let index = cursor.current.pool % pool.length;
        // Skip anything already on screen: dissolving a tile into a photograph
        // that is sitting two cells away reads as a glitch, not a change.
        for (
          let guard = 0;
          guard < pool.length && shownRef.current.includes(index);
          guard++
        ) {
          index = (index + 1) % pool.length;
        }
        cursor.current = { slot: slot + 1, pool: index + 1 };
        return { slot, index };
      });
    }, SWAP_MS);

    return () => clearInterval(id);
  }, [pool.length]);

  // Commit the dissolve once the incoming layer has faded fully up.
  useEffect(() => {
    if (!pending || !ready) return;
    const id = setTimeout(() => {
      setShown((prev) => {
        const next = [...prev];
        next[pending.slot] = pending.index;
        return next;
      });
      setPending(null);
      setReady(false);
    }, FADE_MS);
    return () => clearTimeout(id);
  }, [pending, ready]);

  if (pool.length < MOSAIC_MIN_IMAGES) return null;

  return (
    <div
      className={cn(
        // `min-w-0` because this sits in a grid track: without it a wide child
        // can push the whole shell sideways, and the shell must never scroll
        // horizontally.
        // Tight gaps: the tiles should read as one collage, not as separate
        // framed pictures with air between them.
        "grid min-w-0 gap-1.5 sm:gap-2",
        // Near-square cells in both arrangements: four columns across a square
        // box, six across a 16:10 one. That is what lets a 1x1 span read as a
        // square and a 2x1 as a clean half, instead of every span being its
        // own odd squat rectangle. 16:10 rather than 3:2 so the block stands
        // tall enough to meet the copy column beside it.
        "aspect-square grid-cols-4 grid-rows-4",
        "sm:aspect-2/1 sm:grid-cols-6 sm:grid-rows-4",
        /*
          From `lg` the collage stands beside the copy, and there it takes its
          height FROM the copy instead of from an aspect ratio - the grid track
          stretches (see `lg:items-stretch` on the hero) and this fills it.

          An aspect ratio cannot do that job: height would be a fixed fraction
          of width, so the block overshot the copy column on a wide monitor and
          fell short of it on a small laptop. The cells simply take whatever
          proportion the row gives them, which stays close enough to square at
          every width to keep the arrangement reading correctly.
        */
        "lg:aspect-auto lg:h-full",
        className,
      )}
    >
      {SLOTS.map((slot, i) => {
        const tile = pool[shown[i] % pool.length];
        if (!tile) return null;
        const incoming =
          pending?.slot === i ? pool[pending.index % pool.length] : null;

        return (
          <CollageTile
            key={i}
            tile={tile}
            slot={i}
            incoming={incoming ?? null}
            incomingReady={Boolean(incoming) && ready}
            onIncomingLoad={() => setReady(true)}
            onEngagedChange={handleEngagedChange}
            className={cn(slot.small, slot.wide)}
          />
        );
      })}
    </div>
  );
}
