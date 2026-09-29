import { createStore } from "zustand";
import { HERO_IMAGE_URL } from "@/components/layout/hero-image";

/**
 * Full-page loader shown while the app switches languages.
 *
 * The overlay is a PLAIN DOM NODE appended to <body>, deliberately outside
 * React. A locale switch remounts the entire `[locale]` tree and passes
 * through an intermediate commit where the suspended intl providers render a
 * `null` fallback (empty app shell) - any React-rendered overlay either
 * unmounts for a commit (visible gap) or remounts (its backdrop <img>
 * repaints with a decode gap = visible blink). A foreign DOM node is
 * untouched by all of that: created once at `start()`, it persists through
 * every commit of the switch and is faded + removed at `finish()`.
 *
 * The markup mirrors <LoaderVisual> exactly (same class strings, same
 * MarketVerse mark paths as <BrandMark>), so the compiled CSS already
 * contains every rule it needs (bm-* / brand-verse / brand-orbit-*
 * live in globals.css) and the look stays identical to the
 * boot/org-switch loader. Keep the two in step - a locale switch that showed a
 * different loader than the boot gate would read as the app restarting.
 */

type LocaleSwitchOverlayState = {
  /** Locale we are switching to; null when no switch is in flight. */
  target: string | null;
  start: (locale: string, brand: string) => void;
  finish: () => void;
};

const OVERLAY_ID = "locale-switch-overlay";
const FADE_MS = 500;

/** MarketVerse mark, inlined so the overlay needs no React to render the same
 *  brand mark as <BrandMark>. Theme-aware through the bm-* classes; keep the
 *  paths and gradient ids in sync with brand-mark.tsx. */
const MARK_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true" class="h-12 w-12">
  <defs>
    <linearGradient id="bm-tail-w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f2eee7" stop-opacity="0"></stop><stop offset="0.55" stop-color="#c9c7d0" stop-opacity="0.5"></stop><stop offset="1" stop-color="#f2eee7"></stop></linearGradient>
    <linearGradient id="bm-tail-l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0a0b1e" stop-opacity="0"></stop><stop offset="0.55" stop-color="#4a4956" stop-opacity="0.5"></stop><stop offset="1" stop-color="#0a0b1e"></stop></linearGradient>
  </defs>
  <path class="bm-tail" d="M3 7 C20 8 34 12 44.2 17.8 L43.6 23.3 C32 18.5 17 12 3 7 Z"></path>
  <circle class="bm-a" cx="47" cy="20.5" r="4.2"></circle>
  <path class="bm-bag" d="M20 30 L44 30 L47.3 46.8 Q48 50 44.5 50 L19.5 50 Q16 50 16.7 46.8 Z"></path>
  <path class="bm-handle" d="M27 30 v-2.8 a5 5 0 0 1 10 0 V30" fill="none" stroke-width="2.4" stroke-linecap="round"></path>
  <path class="bm-a" d="M10 11.2 Q10.7 13.3 12.8 14 Q10.7 14.7 10 16.8 Q9.3 14.7 7.2 14 Q9.3 13.3 10 11.2 Z"></path>
  <path class="bm-b" d="M55 10 Q55.5 11.5 57 12 Q55.5 12.5 55 14 Q54.5 12.5 53 12 Q54.5 11.5 55 10 Z" opacity="0.9"></path>
  <path class="bm-a" d="M7 35.6 Q7.6 37.4 9.4 38 Q7.6 38.6 7 40.4 Q6.4 38.6 4.6 38 Q6.4 37.4 7 35.6 Z" opacity="0.85"></path>
  <path class="bm-c" d="M57 40.2 Q57.45 41.55 58.8 42 Q57.45 42.45 57 43.8 Q56.55 42.45 55.2 42 Q56.55 41.55 57 40.2 Z" opacity="0.85"></path>
  <path class="bm-b" d="M12 53.4 Q12.4 54.6 13.6 55 Q12.4 55.4 12 56.6 Q11.6 55.4 10.4 55 Q11.6 54.6 12 53.4 Z" opacity="0.8"></path>
  <circle class="bm-a" cx="52" cy="31" r="0.9" opacity="0.55"></circle>
  <circle class="bm-c" cx="34" cy="57.5" r="1" opacity="0.6"></circle>
</svg>`;

function buildOverlay(brand: string): HTMLElement {
  const root = document.createElement("div");
  root.id = OVERLAY_ID;
  root.setAttribute("role", "status");
  root.className =
    "fixed inset-0 z-100 grid place-items-center bg-background transition-opacity duration-500 ease-out";

  // Mirrors <BrandLockup size="loader" orientation="vertical" effect="orbit">
  // as rendered by <LoaderVisual>. The comet, its track and the progress bar
  // are plain CSS classes from globals.css on purpose: Tailwind never scans
  // this string, so a utility appearing only here would not be generated.
  root.innerHTML = `
    <div class="page-background">
      <img src="${HERO_IMAGE_URL}" alt="" class="object-cover" style="position:absolute;inset:0;width:100%;height:100%" />
    </div>
    <span class="relative flex min-w-0 flex-col items-center gap-5">
      <span class="relative block h-24 w-24">
        <span class="brand-orbit-track"></span>
        <span class="brand-orbit-comet"></span>
        <span class="absolute inset-0 grid place-items-center">
          <span class="flex shrink-0 items-center justify-center h-12 w-12">
            ${MARK_SVG}
          </span>
        </span>
      </span>
      <span class="relative flex min-w-0 flex-col items-center gap-4">
        <span class="relative inline-flex flex-col min-w-0">
          <span class="relative text-sm font-semibold uppercase tracking-[0.3em] pl-[0.3em] text-muted-foreground"></span>
        </span>
      </span>
    </span>`;

  // Two-tone wordmark, mirroring <BrandWordmark>. Static markup (no user
  // input), so innerHTML is safe here; the `brand` argument is kept for the
  // store's public API but the rendered name is the fixed brand lockup.
  void brand;
  const brandEl = root.querySelector("span.text-sm");
  if (brandEl) brandEl.innerHTML = 'Market<span class="brand-verse">Verse</span>';
  return root;
}

let removeTimer: ReturnType<typeof setTimeout> | null = null;

function showOverlay(brand: string) {
  if (typeof document === "undefined") return;
  if (removeTimer) {
    clearTimeout(removeTimer);
    removeTimer = null;
  }
  let node = document.getElementById(OVERLAY_ID);
  if (!node) {
    node = buildOverlay(brand);
    document.body.appendChild(node);
  }
  node.style.opacity = "1";
  node.style.pointerEvents = "auto";
}

function hideOverlay() {
  if (typeof document === "undefined") return;
  const node = document.getElementById(OVERLAY_ID);
  if (!node) return;
  node.style.opacity = "0";
  node.style.pointerEvents = "none";
  if (removeTimer) clearTimeout(removeTimer);
  removeTimer = setTimeout(() => {
    node.remove();
    removeTimer = null;
  }, FADE_MS + 100);
}

export const localeSwitchOverlayStore = createStore<LocaleSwitchOverlayState>(
  (set) => ({
    target: null,
    start: (locale, brand) => {
      showOverlay(brand);
      set({ target: locale });
    },
    finish: () => {
      hideOverlay();
      set({ target: null });
    },
  }),
);
