"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { type ButtonProps } from "@/components/ui/button";

interface ActionButtonProps extends ButtonProps {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  loadingText?: string;
  /**
   * REQUIRED in practice. The confirm click deliberately blocks Radix's
   * auto-close, so this flag falling back to false is the only thing that closes
   * the dialog - omit it and the popup stays open after the action runs.
   */
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  children: React.ReactNode;
}

export function ActionButton({
  title = "Confirm",
  description,
  confirmText = "Yes",
  cancelText = "Cancel",
  loadingText,
  isLoading = false,
  onConfirm,
  children,
}: ActionButtonProps) {
  const [open, setOpen] = React.useState(false);
  // Latched by the confirm click and held until the dialog is opened again.
  //
  // The dialog has an exit animation, so it stays on screen for ~150ms after
  // `open` flips to false. Without this latch the footer renders that whole
  // animation with the confirm button snapped back from its spinner to
  // "Delete" and Cancel lit up again - it reads as if the popup returned to
  // its pre-click state. (Where the caller's row or page disappears with the
  // action there is no animation to see; this is for the cases that stay.)
  const [confirmed, setConfirmed] = React.useState(false);
  const busy = isLoading || confirmed;

  // Close the dialog the moment the action settles.
  //
  // Deliberately a LAYOUT effect. A plain `useEffect` runs after the browser has
  // painted, so the frame where `isLoading` has already flipped to false but the
  // dialog is still open reaches the screen. A layout effect closes it before
  // that paint. Note this fires on ANY falling edge, success or failure - the
  // caller reports a failure with a toast.
  const wasLoading = React.useRef(false);
  React.useLayoutEffect(() => {
    if (wasLoading.current && !isLoading) {
      setOpen(false);
    }
    wasLoading.current = isLoading;
  }, [isLoading]);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Don't let the dialog close while an action is in flight.
        if (isLoading) return;
        // Re-arm on the way in, so a second run starts from a clean footer.
        if (next) setConfirmed(false);
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructiveSolid"
            disabled={busy}
            onClick={(e) => {
              // Prevent Radix from auto-closing the dialog - we close it
              // ourselves once the async action settles.
              e.preventDefault();
              setConfirmed(true);
              onConfirm();
            }}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {loadingText ?? confirmText}
              </>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
