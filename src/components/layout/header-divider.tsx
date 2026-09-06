import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * The rule between a header rail's utility icons and its account controls.
 *
 * A plain `<Separator orientation="vertical">` reads as a chopped-off stub
 * here, because a header has no box for a hairline to sit inside: the rail is
 * a 64px row over a soft, textured background, so a hard-ended line just looks
 * like something that got cropped. Two changes fix that:
 *
 *   - `h-8` pins it to the height of the controls on either side (both the
 *     icon buttons and the auth buttons are 32px), so its bounding box lines
 *     up with them exactly instead of spanning some arbitrary fraction of the
 *     row. It also overrides the base separator's `self-stretch`, which would
 *     otherwise run the line the full height of the header and straight into
 *     its bottom border.
 *   - the ends fade to transparent rather than stopping dead. The color is
 *     held across the middle half and ramps out over the top and bottom
 *     quarters, so the rule has no hard termination anywhere to read as a cut.
 *
 * `bg-transparent` is not redundant: the base `bg-border` is a background
 * COLOR and the gradient is a background IMAGE, so without it the solid color
 * would show through wherever the gradient fades out - exactly the hard ends
 * being designed away.
 *
 * Rendered from inside the auth components' signed-out branch rather than by
 * the headers themselves, so it only ever appears alongside the sign-in and
 * sign-up buttons - a signed-in visitor has a lone avatar there, with nothing
 * on the other side of the rule to divide off.
 */
export function HeaderDivider({ className }: { className?: string }) {
  return (
    <Separator
      orientation="vertical"
      className={cn(
        "h-8 bg-transparent bg-[linear-gradient(to_bottom,transparent,var(--color-border)_25%,var(--color-border)_75%,transparent)]",
        className,
      )}
    />
  );
}
