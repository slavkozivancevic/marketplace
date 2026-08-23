"use client";

import { useCallback, useEffect, useState } from "react";
import { ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSupportsHover } from "@/hooks/useSupportsHover";
import { IMAGE_ZOOM_HINT_LABEL_MS } from "@/constants/constants";

/**
 * The touch counterpart of the gallery's desktop `cursor-zoom-in`.
 *
 * A pointer device advertises the zoom lens for free - the cursor changes on
 * hover. Touch has no hover, so the same lens (entered with a double-tap, see
 * ProductImageCarousel) was completely unadvertised: nothing on screen said
 * the gesture existed. This is that missing signal, in two stages - a labelled
 * coach mark the first time, then a permanent icon-only badge.
 */

/**
 * Set once the visitor has been told about the gesture - either the label sat
 * on screen long enough to read, or they went ahead and used it. Keyed
 * globally rather than per product: opening a second product should not
 * replay the coach mark.
 */
const ZOOM_HINT_SEEN_KEY = "product:zoom-hint-seen";

function readHintSeen(): boolean {
  try {
    return localStorage.getItem(ZOOM_HINT_SEEN_KEY) === "1";
  } catch {
    // Storage unavailable (privacy mode) - treat as unseen. Worst case the
    // label replays on a later visit, which is the harmless direction to err.
    return false;
  }
}

function writeHintSeen(): void {
  try {
    localStorage.setItem(ZOOM_HINT_SEEN_KEY, "1");
  } catch {
    // Nothing to persist to; the in-memory state still collapses the label.
  }
}

export interface ZoomHintState {
  /** Render the badge at all - touch-primary device, past hydration. */
  visible: boolean;
  /** Badge is showing its text label rather than just the icon. */
  expanded: boolean;
  /** Collapse to icon-only and remember it. Call when the gesture is used. */
  dismiss: () => void;
}

export function useZoomHint(): ZoomHintState {
  const supportsHover = useSupportsHover();
  const [hydrated, setHydrated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Both inputs - localStorage and the real matchMedia result - are
  // browser-only, so the first client render has to match the server's
  // (no badge) and the decision is deferred to just after hydration.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only state (localStorage) on mount, deliberately after hydration rather than during render
    setHydrated(true);
    setExpanded(!readHintSeen());
  }, []);

  const visible = hydrated && !supportsHover;

  const dismiss = useCallback(() => {
    setExpanded(false);
    writeHintSeen();
  }, []);

  // The label is a coach mark, not a caption: give it long enough to read,
  // then collapse. Navigating away early leaves it un-dismissed on purpose -
  // an unread hint has not done its job.
  useEffect(() => {
    if (!visible || !expanded) return;
    const timer = setTimeout(dismiss, IMAGE_ZOOM_HINT_LABEL_MS);
    return () => clearTimeout(timer);
  }, [visible, expanded, dismiss]);

  return { visible, expanded, dismiss };
}

interface ZoomHintProps {
  label: string;
  expanded: boolean;
  /** The lens is open on this slide - fade out without unmounting. */
  muted: boolean;
}

export function ZoomHint({ label, expanded, muted }: ZoomHintProps) {
  return (
    <div
      // Decorative for sighted touch users only. Screen readers remap a
      // double tap to "activate", so announcing this instruction would
      // describe a gesture that reader's user cannot perform as written.
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute bottom-2 left-2 z-10 flex items-center rounded-full bg-black/60 p-1.5 text-white shadow-sm backdrop-blur-[2px]",
        "animate-in fade-in slide-in-from-bottom-1 duration-300",
        "transition-opacity motion-reduce:transition-none motion-reduce:animate-none",
        muted ? "opacity-0" : "opacity-100",
      )}
    >
      <ZoomIn className="size-4 shrink-0" />
      {/* 1fr -> 0fr is what actually animates the width. The grid cell is
          `min-w-0 overflow-hidden`, so collapsing the track clips the label
          instead of the badge snapping between two widths.

          The cell itself must stay padding-free: `box-sizing: border-box`
          refuses to shrink an element below its own padding, so spacing put
          here would survive the collapse as a few dead pixels and leave the
          "circle" an off-centre oval. It goes on the inner element, which is
          inside the clip and disappears with the text. */}
      <span
        className={cn(
          "grid text-xs font-medium whitespace-nowrap",
          "transition-[grid-template-columns,opacity] duration-300 ease-out motion-reduce:transition-none",
          expanded ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0",
        )}
      >
        <span className="min-w-0 overflow-hidden">
          <span className="block pl-1.5 pr-0.5">{label}</span>
        </span>
      </span>
    </div>
  );
}
