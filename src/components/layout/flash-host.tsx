"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { takeFlashFor } from "@/lib/navigation/flash";

/**
 * Flushes a queued flash message (see `@/lib/navigation/flash`) once the
 * navigation that queued it has landed. Rendered next to `<Toaster />` in
 * `InnerProviders` so it is mounted on every route and outlives the form that
 * queued the message.
 *
 * Keyed on the pathname rather than the navigation-generation counter: a flash
 * is addressed to one page, so "are we there yet" is the only question worth
 * asking, and it is answered on mount as well as on every change. Renders
 * nothing.
 */
export function FlashHost() {
  const pathname = usePathname();

  useEffect(() => {
    const flash = takeFlashFor(pathname);
    if (!flash) return;
    if (flash.kind === "error") toast.error(flash.message);
    else toast.success(flash.message);
  }, [pathname]);

  return null;
}
