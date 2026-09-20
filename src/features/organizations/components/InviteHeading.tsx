/**
 * Title and description for the standalone invite screen.
 *
 * Deliberately NOT `<PageHeader>`: that is dashboard chrome - it sticks to the
 * top of a scrolling list, paints an opaque star-field strip and closes with a
 * separator border, all of which assume a page column inside an app shell. On
 * the shell-less invite page it rendered as a 448px bordered strip floating
 * above a centered card, left-aligned against a page that is centered.
 *
 * Centered, because everything else on this screen is.
 */
export function InviteHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1.5 text-center">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
