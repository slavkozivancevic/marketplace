"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DepartmentWithImages } from "../db/categories";
import { getCategoryName } from "../utils/translations";
import { useLocale } from "next-intl";

// ---------- Collage ----------

function DepartmentCollage({
  images,
  name,
}: {
  images: string[];
  name: string;
}) {
  if (images.length === 0) {
    return (
      <div className="absolute inset-0 bg-linear-to-br from-muted to-muted/50 flex items-center justify-center">
        <LayoutGrid className="h-10 w-10 text-muted-foreground/30" />
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <Image
        src={images[0]}
        alt={name}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 240px, 260px"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
    );
  }

  if (images.length === 2) {
    return (
      <div className="absolute inset-0 grid grid-cols-2 gap-px bg-border/40">
        {images.map((url, i) => (
          <div key={i} className="relative overflow-hidden">
            <Image
              src={url}
              alt={name}
              fill
              sizes="(max-width: 640px) 25vw, 130px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        ))}
      </div>
    );
  }

  if (images.length === 3) {
    return (
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-border/40">
        {/* First image spans full left column */}
        <div className="relative overflow-hidden row-span-2">
          <Image
            src={images[0]}
            alt={name}
            fill
            sizes="(max-width: 640px) 25vw, 130px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
        {images.slice(1).map((url, i) => (
          <div key={i} className="relative overflow-hidden">
            <Image
              src={url}
              alt={name}
              fill
              sizes="(max-width: 640px) 25vw, 130px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        ))}
      </div>
    );
  }

  // 4 images - 2×2 grid
  return (
    <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-border/40">
      {images.slice(0, 4).map((url, i) => (
        <div key={i} className="relative overflow-hidden">
          <Image
            src={url}
            alt={name}
            fill
            sizes="(max-width: 640px) 25vw, 130px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      ))}
    </div>
  );
}

// ---------- Card ----------

function DepartmentCard({ dept }: { dept: DepartmentWithImages }) {
  const locale = useLocale();
  const name = getCategoryName(dept, locale);

  return (
    <Link
      href={`/products?dept=${dept.slug}`}
      className="group relative overflow-hidden rounded-xl border border-border/50 bg-card aspect-square flex flex-col items-center justify-end hover:border-border hover:shadow-lg hover:shadow-black/10 transition-all duration-300 hover:-translate-y-0.5 shrink-0"
    >
      <DepartmentCollage images={dept.productImages} name={name} />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />

      {/* Vignette - blends card edges into page background, fades on hover */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300 group-hover:opacity-0 group-hover:duration-700"
        style={{
          background: ["to right", "to left", "to bottom", "to top"].map(dir =>
            `linear-gradient(${dir},` +
            `color-mix(in oklch, var(--background) 55%, transparent) 0%,` +
            `color-mix(in oklch, var(--background) 20%, transparent) 8%,` +
            `transparent 22%)`
          ).join(", "),
        }}
      />

      {/* Label */}
      <div className="relative z-10 text-center p-3 w-full">
        <p className="text-sm font-semibold text-white leading-tight truncate">
          {name}
        </p>
      </div>
    </Link>
  );
}

// ---------- Carousel ----------

interface DepartmentCarouselProps {
  departments: DepartmentWithImages[];
  rows?: 2 | 3;
  browseAllLabel: string;
  titleLabel: string;
  subtitleLabel: string;
}

export function DepartmentCarousel({
  departments,
  rows = 2,
  browseAllLabel,
  titleLabel,
  subtitleLabel,
}: DepartmentCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll]);

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir === "left" ? -(el.clientWidth * 0.75) : el.clientWidth * 0.75,
      behavior: "smooth",
    });
  }

  if (departments.length === 0) return null;

  return (
    <section className="py-12 sm:py-20 overflow-x-clip">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {titleLabel}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{subtitleLabel}</p>
          </div>
          <Link
            href="/products"
            className="hidden sm:flex items-center gap-1 text-sm text-primary hover:underline shrink-0"
          >
            {browseAllLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Carousel wrapper */}
        <div className="relative group/carousel">
          {/* Left arrow */}
          <button
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className={cn(
              "absolute left-0 top-1/2 -translate-y-1/2 z-10 -translate-x-4 w-10 h-10 rounded-full border border-white/30 bg-black/55 text-white shadow-[0_4px_14px_rgba(0,0,0,0.4)] backdrop-blur-sm backdrop-saturate-150 flex items-center justify-center transition-[background-color,border-color,box-shadow,color,opacity] duration-300 ease-out hover:bg-black/85 hover:border-white/55 hover:shadow-[0_6px_22px_rgba(0,0,0,0.6)] cursor-pointer active:translate-y-[calc(-50%+1px)] [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]",
              canLeft
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none",
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Scrollable area */}
          <div
            ref={scrollRef}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "grid gap-4 auto-cols-[clamp(160px,22vw,260px)] grid-flow-col",
                rows === 2 ? "grid-rows-2" : "grid-rows-3",
              )}
            >
              {departments.map((dept) => (
                <DepartmentCard key={dept.id} dept={dept} />
              ))}
            </div>
          </div>

          {/* Right arrow */}
          <button
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className={cn(
              "absolute right-0 top-1/2 -translate-y-1/2 z-10 translate-x-4 w-10 h-10 rounded-full border border-white/30 bg-black/55 text-white shadow-[0_4px_14px_rgba(0,0,0,0.4)] backdrop-blur-sm backdrop-saturate-150 flex items-center justify-center transition-[background-color,border-color,box-shadow,color,opacity] duration-300 ease-out hover:bg-black/85 hover:border-white/55 hover:shadow-[0_6px_22px_rgba(0,0,0,0.6)] cursor-pointer active:translate-y-[calc(-50%+1px)] [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]",
              canRight
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none",
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile browse all */}
        <div className="mt-5 text-center sm:hidden">
          <Link
            href="/products"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            {browseAllLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}