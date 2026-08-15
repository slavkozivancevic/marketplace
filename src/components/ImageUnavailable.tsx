import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Muted "image unavailable" placeholder shown in place of the browser's
 * native broken-image icon + alt text once a load has permanently failed
 * (as opposed to still retrying). Fills an absolutely-positioned parent,
 * which itself needs `position: relative` and a definite size (true for the
 * standard `fill` image pattern used across the app).
 */
export function ImageUnavailable({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex items-center justify-center bg-muted pointer-events-none",
        className,
      )}
    >
      <ImageOff className="h-1/4 max-h-10 min-h-4 w-1/4 max-w-10 min-w-4 text-muted-foreground/40" />
    </div>
  );
}