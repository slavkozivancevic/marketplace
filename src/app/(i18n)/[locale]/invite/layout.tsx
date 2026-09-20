/**
 * The invite screen has no app shell - no sidebar, no site header - because it
 * is opened from an email by someone who may not belong to anything yet. That
 * makes it a standalone page like sign-in, and it centers itself the same way
 * `(auth)/layout.tsx` does.
 *
 * Why the scroll container: `.app-shell` is `height: 100dvh` and the document
 * itself cannot scroll (html is `overflow: hidden`), so a shell-less page has
 * to bring its own. Without it, the expired-invite branch on a short viewport
 * would clip its own button off the bottom with no way to reach it. The inner
 * `min-h-full` is what keeps a short card centered while a tall one scrolls
 * from its true top - plain `items-center` on a scroll container cuts off the
 * top of anything taller than the viewport.
 *
 * `overflow-clip` sideways, never `auto`: the shell must not become a
 * horizontal scroll container (see admin/layout.tsx and the sticky-header-bg
 * note in globals.css).
 */
export default function InviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-dvh overflow-y-auto overflow-x-clip">
      <div className="flex min-h-full min-w-0 items-center justify-center px-6 py-12">
        {children}
      </div>
    </div>
  );
}
