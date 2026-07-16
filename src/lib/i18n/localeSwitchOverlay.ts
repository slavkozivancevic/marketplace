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
 * The markup mirrors <AppLoader> exactly (same class strings, same lucide
 * Store icon paths), so the compiled Tailwind CSS already contains every
 * rule it needs and the look stays identical to the boot/org-switch loader.
 */

type LocaleSwitchOverlayState = {
  /** Locale we are switching to; null when no switch is in flight. */
  target: string | null;
  start: (locale: string, brand: string) => void;
  finish: () => void;
};

const OVERLAY_ID = "locale-switch-overlay";
const FADE_MS = 500;

/** lucide "store" icon paths (lucide-react v0.577), inlined so the overlay
 *  needs no React to render the same brand mark as <AppLoader>. */
const STORE_ICON_PATHS = [
  "M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5",
  "M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244",
  "M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05",
];

function buildOverlay(brand: string): HTMLElement {
  const root = document.createElement("div");
  root.id = OVERLAY_ID;
  root.setAttribute("role", "status");
  root.className =
    "fixed inset-0 z-100 grid place-items-center bg-background transition-opacity duration-500 ease-out";

  const svgPaths = STORE_ICON_PATHS.map((d) => `<path d="${d}"></path>`).join("");
  const dot = (delay: string) =>
    `<span class="app-loader-dot h-1.5 w-1.5 rounded-full bg-primary${delay}"></span>`;

  root.innerHTML = `
    <div class="page-background">
      <img src="${HERO_IMAGE_URL}" alt="" class="object-cover" style="position:absolute;inset:0;width:100%;height:100%" />
    </div>
    <div class="flex flex-col items-center gap-8">
      <div class="relative h-24 w-24">
        <div class="app-loader-ring absolute inset-0 animate-spin rounded-full animation-duration-[1s]"></div>
        <div class="absolute inset-0 grid place-items-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">${svgPaths}</svg>
          </div>
        </div>
      </div>
      <div class="flex flex-col items-center gap-3">
        <span class="text-sm font-semibold uppercase tracking-[0.3em] pl-[0.3em] text-muted-foreground"></span>
        <div class="flex items-center gap-1.5">
          ${dot("")}
          ${dot(" [animation-delay:0.15s]")}
          ${dot(" [animation-delay:0.3s]")}
        </div>
      </div>
    </div>`;

  const brandEl = root.querySelector("span.text-sm");
  if (brandEl) brandEl.textContent = brand;
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
