"use client";

import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The "why is Save disabled" line, shown next to a create/submit button.
 *
 * `<FormSaveBar>` renders this same notice itself for edit mode; this component
 * is for the create-mode branch, where forms render a bare submit button. Both
 * paths take the string from `useSaveBlockedReason`, so an admin form never has
 * a disabled button without a reason next to it.
 *
 * Renders nothing unless the form is actually blocked - `blocked` is passed
 * separately from `reason` on purpose, so a stale reason string can never
 * outlive the errors that produced it.
 */
export function SaveBlockedNotice({
  blocked,
  reason,
  className,
}: {
  blocked: boolean;
  reason?: string;
  className?: string;
}) {
  if (!blocked || !reason) return null;

  return (
    <span
      role="status"
      className={cn(
        "flex items-start gap-2 text-sm font-medium text-destructive",
        className,
      )}
    >
      <TriangleAlert className="size-4 shrink-0 translate-y-0.5" aria-hidden />
      <span className="min-w-0">{reason}</span>
    </span>
  );
}
