import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Sign-in and sign-up have no app shell, so they bring their own scroll
 * container: `.app-shell` is `height: 100dvh` and the document itself cannot
 * scroll (html is `overflow: hidden`). Without it the demo panel under Clerk's
 * card was cut off below the fold with no way to reach it.
 *
 * `layout="column"` makes the content box at least as tall as the viewport, so
 * `flex-1` plus `items-center` keeps a short page centered while a tall one
 * scrolls from its true top - plain `items-center` on the scroll container
 * would cut off the top instead. `ScrollArea` rather than `overflow-y-auto`:
 * its overlay thumb takes no width, so the centered card does not shift
 * sideways the moment the page starts to overflow.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ScrollArea layout="column" className="h-dvh">
      <div className="flex min-w-0 flex-1 items-center justify-center">
        {children}
      </div>
    </ScrollArea>
  );
}
