"use client";

import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";

/**
 * A plain `<img>` that renders `fallback` instead once it fails to load.
 *
 * For the small remote pictures that are not worth the optimizer - avatars
 * from the auth provider in the chat and the header. Without this a failed
 * avatar showed the browser's broken-image icon in a 28px circle, while every
 * one of those call sites already had a perfectly good initials badge for the
 * no-picture case. Now a failure falls through to it.
 *
 * Deliberately no retry: an avatar is decoration beside a name, and the
 * initials badge is a complete answer rather than a placeholder.
 */
export function FallbackImg({
  src,
  alt,
  fallback,
  onError,
  ...props
}: ComponentProps<"img"> & { src: string; alt: string; fallback: ReactNode }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  // Keyed by src rather than a boolean, so a new picture gets a fresh try
  // without an effect resetting anything.
  if (failedSrc === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      src={src}
      alt={alt}
      onError={(e) => {
        setFailedSrc(src);
        onError?.(e);
      }}
    />
  );
}
