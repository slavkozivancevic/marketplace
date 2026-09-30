"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { HERO_IMAGE_URL } from "./hero-image";

/**
 * Backdrop for the home hero: the faint fixed photo the rest of the app uses,
 * a drifting constellation of specks joined by hairlines, and two soft
 * brand-tinted glows.
 *
 * The constellation needs a canvas. Lines between particles depend on the
 * distance between every PAIR, so there is nothing to express in CSS - the
 * `.hero-particles` version that lived here for a while could only ever be
 * dots.
 *
 * What it is NOT is the original canvas, which drew ~120 particles and tested
 * every pair each frame at full speed. This one is deliberately quieter and
 * cheaper:
 *   - particle count scales with area and caps at 70,
 *   - the pair test runs on a neighbour grid, not on every pair,
 *   - colours come from the theme's own tokens instead of three hand-written
 *     branches,
 *   - it stops when the tab is hidden, and never starts under
 *     `prefers-reduced-motion` (a single static frame is drawn instead).
 */

const MAX_PARTICLES = 70;
/** One particle per this many square pixels, until the cap. */
const AREA_PER_PARTICLE = 14000;
/** Beyond this distance two particles are not joined. Also the grid cell size. */
const LINK_DISTANCE = 130;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Own brightness, drifting up and down so the field twinkles slowly. */
  alpha: number;
  dAlpha: number;
  radius: number;
};

/**
 * Reads a CSS custom property and returns it only if the canvas can actually
 * paint with it. The theme tokens are `oklch(...)`, which modern engines accept
 * as a fill style directly - but rather than assume, this asks the context:
 * assigning an invalid value leaves `fillStyle` unchanged, so a round trip
 * tells us whether it took.
 */
function usableColor(ctx: CanvasRenderingContext2D, value: string, fallback: string) {
  const probe = "#000000";
  ctx.fillStyle = probe;
  ctx.fillStyle = value;
  return ctx.fillStyle === probe && value !== probe ? fallback : value;
}

export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const root = document.documentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let particles: Particle[] = [];
    let frame = 0;
    let dotColor = "#000";
    let lineColor = "#000";
    let width = 0;
    let height = 0;

    const readTheme = () => {
      const styles = getComputedStyle(root);
      // `--foreground` for the specks, `--brand-accent` for the links: the
      // lines pick up the brand violet, which is what keeps the field from
      // looking like generic grey noise. Both are theme-tuned already, so
      // light, dark and cosmos need no branches here.
      dotColor = usableColor(ctx, styles.getPropertyValue("--foreground").trim(), "#888");
      lineColor = usableColor(ctx, styles.getPropertyValue("--brand-accent").trim(), dotColor);
    };

    const resize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      // `setTransform`, not `scale`: setting canvas.width already resets the
      // context, and scaling on top of a fresh identity would be fine - but
      // this is explicit and cannot compound if that ever changes.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      const count = Math.min(
        Math.floor((width * height) / AREA_PER_PARTICLE),
        MAX_PARTICLES,
      );
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        alpha: Math.random() * 0.5 + 0.2,
        dAlpha: (Math.random() * 0.005 + 0.002) * (Math.random() < 0.5 ? -1 : 1),
        radius: Math.random() * 1.4 + 0.7,
      }));
    };

    /**
     * Joins near neighbours using a spatial grid. The original compared every
     * particle with every other one on every frame; bucketing by `LINK_DISTANCE`
     * means each particle only looks at the cells it could possibly reach, so
     * the work grows with the number of particles rather than with its square.
     */
    const drawLinks = () => {
      const cols = Math.max(1, Math.ceil(width / LINK_DISTANCE));
      const rows = Math.max(1, Math.ceil(height / LINK_DISTANCE));
      const cells: Particle[][] = Array.from({ length: cols * rows }, () => []);

      for (const p of particles) {
        const cx = Math.min(cols - 1, Math.max(0, Math.floor(p.x / LINK_DISTANCE)));
        const cy = Math.min(rows - 1, Math.max(0, Math.floor(p.y / LINK_DISTANCE)));
        cells[cy * cols + cx].push(p);
      }

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 0.6;

      const maxSq = LINK_DISTANCE * LINK_DISTANCE;
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          const here = cells[cy * cols + cx];
          if (here.length === 0) continue;
          // Only forward neighbours, so each pair is considered once.
          for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 1]]) {
            const nx = cx + ox;
            const ny = cy + oy;
            if (nx < 0 || nx >= cols || ny >= rows) continue;
            const there = cells[ny * cols + nx];
            for (let i = 0; i < here.length; i++) {
              const a = here[i];
              // Within the same cell, start past `i` to avoid self and repeats.
              for (let j = ox === 0 && oy === 0 ? i + 1 : 0; j < there.length; j++) {
                const b = there[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dSq = dx * dx + dy * dy;
                if (dSq >= maxSq) continue;
                // Fade the line out as the pair separates.
                ctx.globalAlpha = (1 - Math.sqrt(dSq) / LINK_DISTANCE) * 0.16;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
              }
            }
          }
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha += p.dAlpha;
        if (p.alpha >= 0.75 || p.alpha <= 0.12) p.dAlpha *= -1;
        if (p.x < 0) p.x = width;
        else if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        else if (p.y > height) p.y = 0;
      }

      drawLinks();

      ctx.fillStyle = dotColor;
      for (const p of particles) {
        ctx.globalAlpha = p.alpha * 0.55;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    };

    const loop = () => {
      draw();
      frame = requestAnimationFrame(loop);
    };

    const stop = () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const start = () => {
      if (frame || reduceMotion.matches || document.hidden) return;
      frame = requestAnimationFrame(loop);
    };

    const rebuild = () => {
      resize();
      seed();
      readTheme();
      // Always paint one frame, so a paused or reduced-motion field still shows
      // the constellation rather than an empty box.
      draw();
    };

    const onVisibility = () => (document.hidden ? stop() : start());
    const onMotionChange = () => {
      stop();
      draw();
      start();
    };
    // The theme swaps a class on <html>; the tokens behind the colours change
    // with it, so they have to be read again.
    const themeObserver = new MutationObserver(() => {
      readTheme();
      if (!frame) draw();
    });

    rebuild();
    start();

    window.addEventListener("resize", rebuild);
    document.addEventListener("visibilitychange", onVisibility);
    reduceMotion.addEventListener("change", onMotionChange);
    themeObserver.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      stop();
      window.removeEventListener("resize", rebuild);
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMotion.removeEventListener("change", onMotionChange);
      themeObserver.disconnect();
    };
  }, []);

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

      {/* Constellation. `z-0` keeps it under the hero copy, which carries
          `z-10`, and `pointer-events-none` keeps it out of every click. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      />

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
