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
import { useTranslations } from "next-intl";
import { type ButtonProps } from "@/components/ui/button";

interface ActionButtonProps {
  /** Whether the dialog is open. Owned by the caller - see the note below. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Required, like `confirmText`: the English fallbacks these used to carry
   * ("Confirm", "Yes") could only ever render untranslated, in an app that has
   * no untranslated copy anywhere else.
   */
  title: string;
  description?: string;
  /**
   * Extra content between the description and the footer - a rejection reason,
   * a checkbox. Disable its fields while `isLoading`, like the footer does.
   */
  body?: React.ReactNode;
  confirmText: string;
  /**
   * Why this action cannot run right now - a category that still has
   * subcategories, a brand products still point at. Set it and the dialog
   * explains instead of asking: the reason replaces the description, the
   * confirm button is disabled and the way out reads "Close" rather than
   * "Cancel", since there is nothing to cancel.
   *
   * The server refuses these too (`assertNotInUse`) - this is the half that
   * tells the user why, before they commit to anything.
   */
  blockedReason?: string;
  /**
   * Defaults to the shared localized "Cancel" - pass one only to override it.
   * Ignored while `blockedReason` is set, where the button always reads "Close".
   */
  cancelText?: string;
  loadingText?: string;
  /** The confirm button's look. Destructive by default - most of these delete. */
  confirmVariant?: ButtonProps["variant"];
  /**
   * The action is running. Drives the confirm button's spinner, disables the
   * trigger, and locks the dialog open (it can be neither dismissed nor
   * cancelled mid-flight). Pass the transition's `isPending` - never a literal.
   */
  isLoading: boolean;
  onConfirm: () => void | Promise<void>;
  /**
   * The control that OPENS the dialog - exactly one element, because this
   * component disables it while the action runs (see below). It is a resting
   * control: no spinner, no gerund label. The action runs from the dialog, so
   * that is where the pending state belongs.
   */
  children: React.ReactElement<{ disabled?: boolean }>;
}

/**
 * A control that asks for confirmation before it runs. The only confirmation
 * dialog in the app - if you are about to hand-roll an `<AlertDialog>` with a
 * spinner in its footer, this is the thing you are rebuilding.
 *
 * Two rules it exists to hold:
 *
 * ONE ACTION, ONE SPINNER. The trigger opens the dialog and then rests
 * (disabled, otherwise unchanged); the dialog's confirm button carries the
 * spinner and the gerund. A second spinner behind the overlay's blur is
 * redundant, and swapping a text label there changes the button's width, so the
 * page visibly shifts in the corner of the user's eye while they read the
 * dialog.
 *
 * THE CALLER OWNS `open`. This component never closes itself, because closing
 * is part of the RESULT and only the caller knows when the result is on screen:
 * usually the confirmed row simply unmounts and takes the dialog with it, and
 * where the record survives (a rollback, a status change) the caller closes it
 * on the settled frame - `useWhenSettled`. The one thing that follows from this
 * is the important one: when the action FAILS, the dialog stays open, with the
 * reason in a toast next to it and the confirm button armed again for a retry.
 * An earlier version closed itself on any falling edge of `isLoading` and threw
 * the user back to the list on failure, with a toast as the only trace.
 */
export function ActionButton({
  open,
  onOpenChange,
  title,
  description,
  body,
  confirmText,
  blockedReason,
  cancelText,
  loadingText,
  confirmVariant = "destructiveSolid",
  isLoading,
  onConfirm,
  children,
}: ActionButtonProps) {
  const tCommon = useTranslations("common");

  // Latched by the confirm click, released when the dialog is gone.
  //
  // The dialog has an exit animation, so it stays on screen for ~150ms after
  // `open` flips to false. Without this latch the footer renders that whole
  // animation with the confirm button snapped back from its spinner to
  // "Delete" and Cancel lit up again - it reads as if the popup returned to
  // its pre-click state. (Where the caller's row or page disappears with the
  // action there is no animation to see; this is for the cases that stay.)
  //
  // It is tied to `!open` rather than held until the next opening, because a
  // failed action leaves the dialog open: there the footer has to come back to
  // life so the user can read the toast and try again.
  const [confirmed, setConfirmed] = React.useState(false);
  const busy = isLoading || (confirmed && !open);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Don't let the dialog close while an action is in flight.
        if (isLoading) return;
        // Re-arm on the way in, so a second run starts from a clean footer.
        if (next) setConfirmed(false);
        onOpenChange(next);
      }}
    >
      {/*
        The trigger's disabled state is owned here rather than left to the call
        site: it is the one piece of pending state the trigger legitimately has,
        and hand-wiring it is what let four call sites drift into rendering a
        second spinner and a gerund label behind the dialog's own blur. A caller
        that must disable the trigger for a reason of its own (another action on
        the same row) still passes its own `disabled`; the two are OR-ed.
      */}
      <AlertDialogTrigger asChild>
        {React.cloneElement(children, {
          disabled: isLoading || children.props.disabled,
        })}
      </AlertDialogTrigger>
      {/*
        One width for every confirmation, and no prop to pick it with. These
        dialogs carry two or three sentences - a blocked reason names a count
        and what to do about it - and the `sm` variant is 320px of centred text,
        which breaks that into five or six lines. The size split was the last
        thing left over from the twelve hand-rolled copies.
      */}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {(blockedReason ?? description) && (
            <AlertDialogDescription>
              {blockedReason ?? description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {!blockedReason && body}
        <AlertDialogFooter>
          {/*
            A blocked dialog always says "Close", even when the caller passed a
            cancelText: that label describes calling the action off ("Keep
            order", "Cancel"), and there is no action to call off here - nothing
            was ever going to run. Leaving the caller's label in place is what
            made the blocked category dialog offer "Cancel".
          */}
          <AlertDialogCancel disabled={busy}>
            {blockedReason ? tCommon("close") : (cancelText ?? tCommon("cancel"))}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={confirmVariant}
            disabled={busy || !!blockedReason}
            onClick={(e) => {
              // Prevent Radix from auto-closing the dialog: it would close on
              // the click, long before the action it confirms has run.
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
