"use client";

import { useCallback, useState } from "react";
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

  // A cached image can finish loading before React attaches `onLoad`, so the
  // load event is missed and the shimmer would spin forever. This is common on
  // a client-side navigation right after an upload (e.g. creating a product and
  // landing on the list): the freshly-uploaded thumbnail is already in the
  // browser cache, so the <img> mounts already `complete`. The ref callback
  // catches that case - if the element reports a decoded image the moment it's
  // attached, treat it as loaded.
  const refCallback = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 z-10 skeleton-shimmer pointer-events-none" />
      )}
      <Image
        {...props}
        ref={refCallback}
        alt={props.alt}
        className={cn(props.className)}
        onLoad={(e) => {
          setLoaded(true);
          props.onLoad?.(e);
        }}
        onError={(e) => {
          // Clear the shimmer on failure too, so a broken/blocked URL never
          // leaves an endlessly spinning placeholder.
          setLoaded(true);
          props.onError?.(e);
        }}
      />
    </>
  );
}
