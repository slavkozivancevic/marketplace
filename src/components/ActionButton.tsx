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

  // When the action completes, close the dialog.
  const wasLoading = React.useRef(false);
  React.useEffect(() => {
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
          <AlertDialogCancel disabled={isLoading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isLoading}
            onClick={(e) => {
              // Prevent Radix from auto-closing the dialog - we close it
              // ourselves once the async action settles.
              e.preventDefault();
              onConfirm();
            }}
          >
            {isLoading ? (
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
