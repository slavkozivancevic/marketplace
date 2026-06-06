import { cn } from "@/lib/utils";

/**
 * A four-sided gradient overlay that fades the edges of a product image
 * into the surrounding card surface. Sits inside a `relative` parent
 * (typically the image hero) and disappears on hover via the parent's
 * `group-hover:opacity-0` so the image reveals its true edges only when
 * the user engages with the card. Used standalone for static image
 * thumbnails; `HoverImageCycler` ships the same effect inline for the
 * client-side cycling case.
 */
export function ImageEdgeFade({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out",
        "opacity-100 group-hover:opacity-0",
        className,
      )}
      style={{
        background: ["to right", "to left", "to bottom", "to top"]
          .map(
            (dir) =>
              `linear-gradient(${dir},` +
              `color-mix(in oklch, var(--background) 55%, transparent) 0%,` +
              `color-mix(in oklch, var(--background) 30%, transparent) 7%,` +
              `color-mix(in oklch, var(--background) 10%, transparent) 14%,` +
              `color-mix(in oklch, var(--background) 2%, transparent) 20%,` +
              `transparent 25%)`,
          )
          .join(", "),
      }}
    />
  );
}
