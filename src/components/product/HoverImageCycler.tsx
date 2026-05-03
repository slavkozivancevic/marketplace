"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface HoverImageCyclerProps {
  images: string[];
  alt: string;
  className?: string;
  intervalMs?: number;
  sizes?: string;
}

export function HoverImageCycler({
  images,
  alt,
  className,
  intervalMs = 900,
  sizes = "(max-width: 768px) 100vw, 33vw",
}: HoverImageCyclerProps) {
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (images.length === 0) return null;

  const handleEnter = () => {
    setIsHovered(true);
    if (images.length <= 1) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, intervalMs);
  };

  const handleLeave = () => {
    setIsHovered(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIndex(0);
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        images.length > 1 && "cursor-grab",
        className,
      )}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {!loaded && (
        <div className="absolute inset-0 z-10 skeleton-shimmer" />
      )}
      {images.map((url, i) => (
        <Image
          key={url}
          src={url}
          alt={alt}
          fill
          sizes={sizes}
          className={cn(
            "object-cover transition-opacity duration-500",
            i === index ? "opacity-100" : "opacity-0",
          )}
          priority={i === 0}
          onLoad={i === 0 ? () => setLoaded(true) : undefined}
        />
      ))}
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          isHovered ? "opacity-0" : "opacity-100",
        )}
        style={{
          background: [
            "to right",
            "to left",
            "to bottom",
            "to top",
          ].map(dir =>
            `linear-gradient(${dir},` +
            `color-mix(in oklch, var(--background) 55%, transparent) 0%,` +
            `color-mix(in oklch, var(--background) 30%, transparent) 7%,` +
            `color-mix(in oklch, var(--background) 10%, transparent) 14%,` +
            `color-mix(in oklch, var(--background) 2%, transparent) 20%,` +
            `transparent 25%)`
          ).join(", "),
          transition: isHovered
            ? "opacity 700ms ease"
            : "opacity 300ms ease",
        }}
      />
      {images.length > 1 && (
        <div className="pointer-events-none absolute bottom-2 left-0 right-0 flex justify-center gap-1">
          {images.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                i === index ? "bg-white" : "bg-white/50",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
