"use client";

import { cn } from "@/lib/utils";
import { useSelectGesture } from "../hooks/useSelectGesture";
import { useSelectionStore } from "../store/selectionStore";

/**
 * A message row that can be picked, as on WhatsApp: a held press on touch
 * (which also opens the emoji bar - a phone has no hover trigger), or
 * right-click with a mouse (the visible way is the chevron beside the bubble,
 * see MessageChevron). The picked row is tinted across the thread's width and
 * the header turns into its action bar (MessageActionBar).
 *
 * A message still in the outbox has no server copy to act on: `disabled`
 * leaves it an ordinary row.
 */
export function SelectableMessage({
  conversationId,
  messageId,
  disabled = false,
  onPress,
  className,
  children,
}: {
  conversationId: string;
  messageId: string;
  disabled?: boolean;
  /** A held press (touch) - the thread opens the emoji bar over the message. */
  onPress?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const picked = useSelectionStore(
    (s) =>
      s.selected?.kind === "message" &&
      s.selected.conversationId === conversationId &&
      s.selected.messageId === messageId,
  );
  const selectMessage = useSelectionStore((s) => s.selectMessage);
  const gesture = useSelectGesture((source) => {
    selectMessage(conversationId, messageId, source === "press");
    if (source === "press") onPress?.();
  });

  return (
    <div
      {...(disabled ? {} : gesture)}
      data-picked={picked || undefined}
      // data-keep-selection: a click on the picked row itself must not count
      // as "clicked elsewhere" and clear it (see MessageThread).
      data-keep-selection={picked || undefined}
      className={cn(
        // The touch callout and text selection would fight the held press.
        "-mx-2 rounded-lg px-2 py-0.5 transition-colors [-webkit-touch-callout:none] pointer-coarse:select-none",
        picked && "bg-primary/15",
        className,
      )}
    >
      {children}
    </div>
  );
}
