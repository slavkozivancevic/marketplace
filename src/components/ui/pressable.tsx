"use client";

import { useLinkStatus } from "next/link";

/**
 * Press feedback for every clickable surface that is not a `<Button>` - a
 * table row that opens a record, a sidebar link, a product card, a menu item.
 *
 * Three states, one ladder, same as `buttonVariants`:
 *
 * 1. Hover (mouse only): a light tint. Tailwind 4 already gates `hover:` to
 *    devices that hover, so it never latches on a touch screen.
 * 2. Pressed: a stronger tint while the mouse button or the finger is down.
 *    Tailwind's preflight turns off the browser's own tap highlight, so on a
 *    phone this `:active` tint is the ONLY sign that a tap landed. It snaps in
 *    (`duration-0`) because a tap lasts about 100ms and the row's 150ms colour
 *    transition would swallow it; it fades out on release. The browser drops
 *    `:active` as soon as the finger starts to scroll, so scrolling a list
 *    does not leave rows lit.
 * 3. Pending (links only): the row you clicked KEEPS the pressed tint until
 *    the next page arrives. The top progress bar says "something is loading",
 *    not what - this says which row. Our `Link` (`@/i18n/navigation`)
 *    renders `<LinkPendingMark />` itself, so a surface that IS the link
 *    (a nav item, a `<Button asChild>`) reacts through `:has()` with nothing
 *    to add. A surface INSIDE the link - a row under a `display: contents`
 *    link, a `<Card>` - needs its own `<LinkPendingMark />` inside it, since
 *    `:has()` only looks down.
 *
 * `:active` also matches every ancestor of the element being pressed, so a
 * row's own icon buttons (edit, duplicate, delete) would light the whole row
 * - the press is gated off while a button inside it is the one held down.
 *
 * The pending rules come in two forms - with and without `hover:` - because
 * `:has([attr])` and `:hover` weigh the same, so a pending row under the
 * pointer would otherwise fall back to the lighter hover tint depending on
 * stylesheet order. The `hover:` form outweighs plain hover.
 */
export const pressSurface =
  "hover:bg-muted/50 active:not-has-[button:active]:bg-muted active:duration-0 has-data-link-pending:bg-muted has-data-link-pending:hover:bg-muted has-data-link-pending:duration-0";

/**
 * A muted navigation link (sidebar, mobile menu): `pressSurface` plus the
 * text stepping up to full colour on every state that tints it.
 */
export const pressNavLink = `text-muted-foreground hover:text-foreground active:text-foreground has-data-link-pending:text-foreground ${pressSurface}`;

/**
 * The same ladder for a card whose image covers most of it, where a tint
 * alone barely shows: the card also settles in a little while pressed or
 * pending (the iOS / Material card press), and drops its hover lift.
 */
export const pressCard =
  "active:not-has-[button:active]:scale-[0.98] active:not-has-[button:active]:translate-y-0 active:not-has-[button:active]:bg-muted/40 active:duration-0 has-data-link-pending:scale-[0.98] has-data-link-pending:translate-y-0 has-data-link-pending:hover:translate-y-0 has-data-link-pending:bg-muted/40 has-data-link-pending:duration-0";

/**
 * An image tile (department collage, mosaic tile) that already grows on
 * hover: a press that shrank it would jump from the hover scale, so the image
 * darkens instead - the photo-grid press.
 */
export const pressTile =
  "active:not-has-[button:active]:brightness-90 active:duration-0 has-data-link-pending:brightness-90 has-data-link-pending:duration-0";

/**
 * A control with no surface of its own - a text link, an underlined action, a
 * bare icon (clear X, back arrow, close). It dims while pressed and while its
 * navigation is pending, the system text-button press, and the same
 * `opacity-50`-family signal `PendingLinkButton` uses for a link in flight.
 * Opacity is colour-agnostic, so it reads the same on muted, primary and
 * destructive text.
 */
export const pressText =
  "active:opacity-60 active:duration-0 has-data-link-pending:opacity-60 has-data-link-pending:duration-0";

/**
 * Marks its nearest ancestor `<Link>` as pending while the navigation it
 * started is in flight. Renders nothing at rest and a hidden, empty span while
 * pending - no layout, nothing for assistive technology. It must sit inside
 * the element that carries `pressSurface` / `pressCard`, since `:has()` looks
 * down from there.
 */
export function LinkPendingMark() {
  const { pending } = useLinkStatus();
  return pending ? <span hidden data-link-pending="" /> : null;
}
