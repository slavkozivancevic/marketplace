"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMobileBottomBarStore } from "@/store/mobileBottomBar";

/**
 * The round button that opens a page's side panel on narrow screens - the
 * dashboard/admin navigation, the messages inbox. One component so every
 * side panel opens from the same place and looks the same; render it as a
 * `SheetTrigger asChild` child and hide it at the breakpoint where the panel
 * is drawn inline.
 *
 * A page with a full-width footer at the bottom of the viewport (an edit
 * form's save bar, the chat composer) registers it in `mobileBottomBar`, and
 * the button lifts to clear it instead of sitting on its controls.
 */
export function FloatingSidebarTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  const bottomBarPresent = useMobileBottomBarStore((s) => s.count > 0);
  return (
    <Button
      variant="default"
      size="icon"
      className={cn(
        "fixed left-4 z-40 h-12 w-12 rounded-full shadow-lg hover:brightness-110 transition-[bottom] duration-200",
        bottomBarPresent
          ? "bottom-[calc(6rem+env(safe-area-inset-bottom))]"
          : "bottom-[calc(1rem+env(safe-area-inset-bottom))]",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
