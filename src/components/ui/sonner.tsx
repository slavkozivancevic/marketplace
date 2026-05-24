"use client";

import { useTheme } from "next-themes";
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

const Toaster = ({ ...props }: ToasterProps) => {
  // resolvedTheme always returns "light" or "dark" (system -> resolved class).
  // We map our custom "cosmos" theme to "dark" so Sonner picks the correct
  // built-in palette for --success-bg / --warning-bg / --error-bg variables -
  // without this, richColors had nothing to resolve and toasts stayed neutral.
  const { resolvedTheme } = useTheme();
  const sonnerTheme: ToasterProps["theme"] =
    resolvedTheme === "dark" || resolvedTheme === "cosmos" ? "dark" : "light";

  return (
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
    />
  );
};

export { Toaster, sonnerToast as toast };
