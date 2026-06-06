import { LoadingImage } from "@/components/ui/LoadingImage";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  src: string | null | undefined;
  name: string;
  /** Pixel size (square). Defaults to 40 - matches admin list cells. */
  size?: number;
  /** `square` = `rounded-sm`, `circle` = `rounded-full`. */
  shape?: "square" | "circle";
  /** `default` is for plain panels/lists (`bg-muted` + border). `overlay`
   *  is for badges sitting on top of product imagery and uses a backdrop-
   *  blurred translucent surface so the logo reads against any backdrop. */
  variant?: "default" | "overlay";
  className?: string;
}

/**
 * Single source of truth for "brand logo in a chip". All admin lists,
 * seller cards, product badges and public brand cards render through
 * this so logo treatment (frame, background, fallback initials) stays
 * consistent across every surface.
 *
 * We deliberately use `bg-muted` (matching the admin convention) rather
 * than a forced white canvas: white square frames look fine for a single
 * logo style but turn inconsistent against the rest of the UI when a
 * brand's logo already has its own colored or transparent backdrop.
 */
export function BrandLogo({
  src,
  name,
  size = 40,
  shape = "square",
  variant = "default",
  className,
}: BrandLogoProps) {
  const radius = shape === "circle" ? "rounded-full" : "rounded-sm";
  const surface =
    variant === "overlay"
      ? "bg-background/85 backdrop-blur-xs border border-border/40"
      : "bg-muted border border-border/40";
  const initials = name.slice(0, 2).toUpperCase();

  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center font-medium text-muted-foreground shrink-0",
          radius,
          surface,
          className,
        )}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(10, Math.round(size * 0.35)),
        }}
        aria-label={name}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={cn("relative overflow-hidden shrink-0", radius, surface, className)}
      style={{ width: size, height: size }}
    >
      <LoadingImage
        src={src}
        alt={name}
        fill
        sizes={`${size}px`}
        className="object-contain"
        unoptimized
      />
    </div>
  );
}
