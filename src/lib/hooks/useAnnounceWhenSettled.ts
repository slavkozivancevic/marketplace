"use client";

import { toast } from "@/components/ui/sonner";
import { useWhenSettled } from "./useWhenSettled";

type Announcement = {
  message: string;
  action?: { label: string; onClick: () => void };
};

/**
 * Holds a success toast back until the transition that will SHOW its result has
 * settled.
 *
 * Why: a server action returns long before the list on screen reflects it. A
 * toast raised the moment the action resolves announces a deletion while the row
 * is still sitting there, and a duplicate before the copy exists on screen - the
 * confirmation arrives ahead of the thing it confirms.
 *
 * This is {@link useWhenSettled} with the success toast already wired up; reach
 * for that one directly when what has to wait for the result is something other
 * than a message (closing an editor over the record it just changed, say).
 */
export function useAnnounceWhenSettled(isPending: boolean) {
  const whenSettled = useWhenSettled(isPending);

  /** Call from inside the transition, after the action succeeds. */
  return (announcement: Announcement) => {
    whenSettled(() =>
      toast.success(
        announcement.message,
        announcement.action ? { action: announcement.action } : undefined,
      ),
    );
  };
}
