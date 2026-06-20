import { LoadingImage } from "@/components/ui/LoadingImage";
import { cn } from "@/lib/utils";

/**
 * How a logo wants to be backed. Mirrors the `LogoBackdrop` Prisma enum so a
 * brand row can be passed straight through. The treatment is deliberately
 * theme-INDEPENDENT (a dark logo gets a light tile in light AND dark mode) so
 * the logo never disappears into a same-luminance background.
 *
 * - `AUTO`    - not yet analyzed; treated like `LIGHT` (the safe default since
 *               most logos are dark-on-transparent).
 * - `LIGHT`   - dark/colored logo -> always render on a light tile.
 * - `DARK`    - light/white logo  -> always render on a dark tile.
 * - `NEUTRAL` - logo carries its own opaque background -> no added tile.
 */
export type LogoBackdrop = "AUTO" | "LIGHT" | "DARK" | "NEUTRAL";

interface BrandLogoProps {
  src: string | null | undefined;
  name: string;
  /** Pixel size (square). Defaults to 40 - matches admin list cells. */
  size?: number;
  /** `square` = `rounded-sm`, `circle` = `rounded-full`. */
  shape?: "square" | "circle";
  /** `default` is for plain panels/lists. `overlay` is for badges sitting on
   *  top of product imagery and uses a backdrop-blurred translucent surface. */
  variant?: "default" | "overlay";
  /** Backdrop for `src`. Defaults to `AUTO` (light tile). */
  backdrop?: LogoBackdrop;
  /** Optional second asset designed for dark surfaces. When present the chip
   *  becomes theme-following: `src` shows in light themes, `srcDark` in dark
   *  ones (the dark/cosmos custom variant). */
  srcDark?: string | null;
  /** Backdrop for `srcDark`, independent of `backdrop` so each asset gets the
   *  tile its own luminance needs. */
  backdropDark?: LogoBackdrop;
  className?: string;
}

/** Fixed (theme-independent) tile for a single asset, by its backdrop. */
function tileFor(backdrop: LogoBackdrop): { surface: string; padded: boolean } {
  switch (backdrop) {
    case "DARK":
      return { surface: "bg-logo-dark", padded: true };
    case "NEUTRAL":
      // Logo brings its own background; don't fight it - just clip + frame.
      return { surface: "bg-transparent", padded: false };
    case "LIGHT":
    case "AUTO":
    default:
      return { surface: "bg-logo-light", padded: true };
  }
}

/**
 * Single source of truth for "brand logo in a chip". All admin lists, seller
 * cards, product badges and public brand cards render through this so logo
 * treatment (frame, background, fallback initials) stays consistent across
 * every surface - and, crucially, so each asset's backdrop is chosen from that
 * asset's own luminance rather than the active theme.
 */
export function BrandLogo({
  src,
  name,
  size = 40,
  shape = "square",
  variant = "default",
  backdrop = "AUTO",
  srcDark,
  backdropDark = "AUTO",
  className,
}: BrandLogoProps) {
  const radius = shape === "circle" ? "rounded-full" : "rounded-sm";
  const initials = name.slice(0, 2).toUpperCase();
  // Pick the best asset per theme, each falling back to the other so a brand
  // that only filled one of the two URLs still shows a logo in both themes
  // (e.g. only `srcDark` set -> use it everywhere instead of dropping to
  // initials). Theme-following swap only kicks in when the two differ.
  const lightSrc = src || srcDark || null;
  const darkSrc = srcDark || src || null;
  const hasDarkAsset = Boolean(darkSrc && darkSrc !== lightSrc);
  // The backdrop of whichever asset occupies each theme slot.
  const lightBackdrop = src ? backdrop : backdropDark;
  const darkBackdrop = srcDark ? backdropDark : backdrop;

  const frameBorder = "border border-border/40 shrink-0";

  // No image: the fixed logo tile is pointless (it exists so a logo image
  // reads against any theme). The initials are text we control, so back them
  // with a theme-AWARE neutral surface that follows light/dark instead of a
  // forced white tile. The overlay variant keeps its frosted surface.
  if (!lightSrc) {
    const initialsSurface =
      variant === "overlay"
        ? "bg-background/85 backdrop-blur-xs text-muted-foreground"
        : "bg-muted text-muted-foreground";
    return (
      <div
        className={cn(
          "flex items-center justify-center font-medium",
          radius,
          frameBorder,
          initialsSurface,
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

  // One image layer. The tile background lives here (not on the outer frame) so
  // each theme's asset gets its own surface, and the theme-visibility class on
  // this wrapper hides the LoadingImage shimmer together with the image - a
  // hidden (`display:none`) image never lazy-loads, so its onLoad would never
  // fire to clear the shimmer if the shimmer stayed visible.
  const layer = (assetSrc: string, assetBackdrop: LogoBackdrop, visibility?: string) => {
    const { surface, padded } =
      variant === "overlay"
        ? { surface: "bg-background/85 backdrop-blur-xs", padded: false }
        : tileFor(assetBackdrop);
    // A small inset lets transparent logos breathe and keeps them off the
    // rounded corners. Skip it for NEUTRAL logos that own their full canvas.
    const pad = padded ? Math.round(size * 0.12) : 0;
    return (
      <div className={cn("absolute inset-0", surface, visibility)} style={{ padding: pad }}>
        <div className="relative h-full w-full">
          <LoadingImage
            src={assetSrc}
            alt={name}
            fill
            sizes={`${size}px`}
            className="object-contain"
            unoptimized
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn("relative overflow-hidden", radius, frameBorder, className)}
      style={{ width: size, height: size }}
    >
      {hasDarkAsset ? (
        <>
          {layer(lightSrc, lightBackdrop, "dark:hidden")}
          {layer(darkSrc!, darkBackdrop, "hidden dark:block")}
        </>
      ) : (
        layer(lightSrc, lightBackdrop)
      )}
    </div>
  );
}
