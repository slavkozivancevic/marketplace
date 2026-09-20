"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/providers/theme/ThemeProvider";
import {
  Toaster as Sonner,
  type ToasterProps,
  toast as sonnerToast,
} from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

/** False on the server and through hydration, true once the client has taken over. */
const subscribeToNothing = () => () => {};
function useIsHydrated() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

const Toaster = ({ ...props }: ToasterProps) => {
  // resolvedTheme always returns "light" or "dark" (system -> resolved class).
  // We map our custom "cosmos" theme to "dark" so Sonner picks the correct
  // built-in palette for --success-bg / --warning-bg / --error-bg variables -
  // without this, richColors had nothing to resolve and toasts stayed neutral.
  const { resolvedTheme } = useTheme();
  const sonnerTheme: ToasterProps["theme"] =
    resolvedTheme === "dark" || resolvedTheme === "cosmos" ? "dark" : "light";

  // Portaled to <body>, the way Radix portals a dialog's overlay and content.
  //
  // Sonner renders in place, and this Toaster is mounted deep inside
  // `.app-shell` - the wrapper that globals.css blurs while any modal overlay is
  // open. `filter` blurs the whole subtree, and CSS gives a descendant no way to
  // opt out, so every toast raised from inside a dialog or sheet came out
  // blurred, and on narrow screens sat behind the dialog as well. A toast is not
  // page content: it belongs to the same floating layer as the dialog, which
  // escapes the blur precisely because Radix portals it out.
  //
  // Rendering null until hydration keeps the server and first client render
  // identical (both empty), so there is nothing to mismatch - and no toast can
  // be raised before the app is interactive anyway. Read through
  // `useSyncExternalStore` rather than state-in-an-effect, the same way
  // useSupportsHover and the nav-generation store do it here.
  if (!useIsHydrated()) return null;

  return createPortal(
    <Sonner
      theme={sonnerTheme}
      className="toaster group"
      richColors
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      {...props}
    />,
    document.body,
  );
};

export { Toaster, sonnerToast as toast };
