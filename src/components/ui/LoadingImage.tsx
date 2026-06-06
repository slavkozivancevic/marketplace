"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

/**
 * Drop-in replacement for `next/image` that overlays the `skeleton-shimmer`
 * placeholder while the image is loading. Use it anywhere a remote thumbnail
 * should show a visible loading state.
 *
 * Requires a positioned parent: the shimmer is `absolute inset-0`, so the
 * wrapper around the image needs to be `relative` (true for the standard
 * `fill` + aspect-ratio pattern we use across the app).
 */
export function LoadingImage(props: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 z-10 skeleton-shimmer pointer-events-none" />
      )}
      <Image
        {...props}
        alt={props.alt}
        className={cn(props.className)}
        onLoad={(e) => {
          setLoaded(true);
          props.onLoad?.(e);
        }}
      />
    </>
  );
}
