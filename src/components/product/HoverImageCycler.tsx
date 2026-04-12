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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (images.length === 0) return null;

  const handleEnter = () => {
    if (images.length <= 1) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, intervalMs);
  };

  const handleLeave = () => {
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
        />
      ))}
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
