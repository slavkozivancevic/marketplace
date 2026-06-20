"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLogoLayerProps {
  src: string;
  alt: string;
  /** Pixel size (square) of the parent chip - used for `sizes`. */
  size: number;
  /** Tile surface class (e.g. `bg-logo-light`) shown behind the logo. */
  surface: string;
  /** Inset (px) so transparent logos breathe; 0 for full-canvas logos. */
  pad: number;
  /** Theme-visibility class (`dark:hidden` / `hidden dark:block`) or undefined. */
  visibility?: string;
}

/**
 * A single brand-logo image layer with its own loading state.
 *
 * While the image loads, ONLY a full-bleed shimmer shows - it covers the entire
 * chip so the tile surface and its inset (the "frame") are never visible around
 * a still-loading placeholder. Once the image is decoded, the tile + padded
 * image fade in together, which is also when the computed logo backdrop reads
 * correctly. This is the fix for the old "white frame, then shimmer inside it"
 * look.
 */
export function BrandLogoLayer({ src, alt, size, surface, pad, visibility }: BrandLogoLayerProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={cn("absolute inset-0", visibility)}>
      {/* Full-bleed shimmer until the image is ready - opaque, so it hides the
          tile surface and inset beneath it. */}
      {!loaded && (
        <div className="absolute inset-0 z-10 skeleton-shimmer pointer-events-none" />
      )}
      {/* Tile + padded image, revealed only once loaded so no bare frame shows. */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-200",
          surface,
          loaded ? "opacity-100" : "opacity-0",
        )}
        style={{ padding: pad }}
      >
        <div className="relative h-full w-full">
          <Image
            src={src}
            alt={alt}
            fill
            sizes={`${size}px`}
            className="object-contain"
            unoptimized
            onLoad={() => setLoaded(true)}
          />
        </div>
      </div>
    </div>
  );
}
