"use client";

import { useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Contextual save bar (Shopify / Stripe style). Rendered in place of a bare
 * submit button. While the form has unsaved changes it becomes a floating bar
 * that sticks to the bottom of the scroll container, surfacing a clear
 * "unsaved changes" signal plus Discard / Save actions. When the form is clean
 * it collapses to a quiet "all changes saved" line so the saved state is
 * always legible.
 *
 * `Save` is a real `type="submit"`, so the parent `<form onSubmit>` handles it.
 * `onDiscard` should reset the form back to its saved baseline (`form.reset()`).
 * `saveDisabled` blocks saving while the form is invalid (the reason is shown by
 * the per-field messages).
 */
export function FormSaveBar({
  isDirty,
  isPending,
  onDiscard,
  saveLabel,
  saveDisabled = false,
  sticky = true,
  className,
}: {
  isDirty: boolean;
  isPending: boolean;
  onDiscard: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  /** When false, renders inline (no floating/sticky card) - use when the form
   *  already has its own pinned footer. */
  sticky?: boolean;
  className?: string;
}) {
  const t = useTranslations("form");

  if (!isDirty) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-sm text-muted-foreground",
          className,
        )}
      >
        <Check className="size-4" aria-hidden />
        {t("allSaved")}
      </div>
    );
  }

  const bar = (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        sticky &&
          "sticky bottom-4 z-10 rounded-lg border bg-background/95 px-4 py-3 shadow-lg backdrop-blur",
        className,
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <span
          className="size-2 shrink-0 rounded-full bg-amber-500"
          aria-hidden
        />
        {t("unsavedChanges")}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onDiscard}
          disabled={isPending}
        >
          {t("discard")}
        </Button>
        <Button type="submit" disabled={isPending || saveDisabled}>
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? t("saving") : (saveLabel ?? t("save"))}
        </Button>
      </div>
    </div>
  );

  // In sticky mode the bar floats over the bottom of the scroll area. Reserve
  // space before it so it never overlaps (and blocks clicks on) the form's last
  // fields when stuck.
  if (sticky) {
    return (
      <>
        <div aria-hidden className="h-20" />
        {bar}
      </>
    );
  }
  return bar;
}
