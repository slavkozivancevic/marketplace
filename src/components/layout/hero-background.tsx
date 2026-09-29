import Image from "next/image";
import { HERO_IMAGE_URL } from "./hero-image";

/**
 * Quiet backdrop for the home hero: the faint fixed photo the rest of the app
 * already uses, plus two soft brand-tinted glows.
 *
 * This used to run a full particle canvas - ~120 dots drifting with lines
 * drawn between every pair inside the connection radius, redrawn every frame.
 * That constellation is the single most recognisable generated-landing-page
 * motif there is, and it cost a `requestAnimationFrame` loop with an O(n2)
 * inner pass for the privilege. The hero now earns its interest from the
 * catalogue itself (see `<DepartmentMosaic>`), so the backdrop's job is to
 * stay out of its way.
 *
 * The specks survive, though - as `.hero-particles`, four tiled gradients
 * drifting on a two-minute cycle. No lines, no canvas, no JavaScript, and
 * slow enough to read as depth instead of as movement.
 *
 * No canvas means no hooks, so this is a plain Server Component now. The
 * cosmos theme still paints its own `.star-field` sparkles over the page -
 * that is the theme's brand identity (the mark is a comet in a star field),
 * not decoration bolted onto the hero.
 */
export function HeroBackground() {
  return (
    <>
      {/* Fixed background photo - grayscale, low opacity. `notFoundResponse`
          mirrors this treatment inline; keep them in step. */}
      <div className="fixed inset-0 -z-10">
        <Image
          src={HERO_IMAGE_URL}
          alt=""
          fill
          className="object-cover grayscale opacity-[0.08] dark:opacity-[0.05] cosmos:grayscale-40 cosmos:opacity-[0.07] cosmos:hue-rotate-220 scale-110"
          sizes="100vw"
          priority
          unoptimized
        />
      </div>

      {/* Drifting specks - see `.hero-particles` in globals.css. */}
      <div aria-hidden className="hero-particles" />

      {/* Brand glows. `.hero-glow` is a `--brand-accent` radial, so it resolves
          per theme instead of needing a light/dark pair. */}
      <div
        aria-hidden
        className="hero-glow -top-40 -left-32 h-112 w-md opacity-70"
      />
      <div
        aria-hidden
        className="hero-glow top-1/3 -right-24 h-128 w-lg opacity-50"
      />
    </>
  );
}
