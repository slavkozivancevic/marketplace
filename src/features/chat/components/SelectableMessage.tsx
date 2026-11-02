"use client";

import { useTranslations } from "next-intl";
import { Reply } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { useSelectGesture } from "../hooks/useSelectGesture";
import { useSwipeReply } from "../hooks/useSwipeReply";
import { useMessageSelectionActive, useSelectionStore } from "../store/selectionStore";
import { SWIPE_REPLY_PX } from "../utils/swipe";

/**
 * A message row, with WhatsApp's gestures:
 *
 * - a held press on touch (which also opens the emoji bar - a phone has no
 *   hover trigger), right-click, or the bubble menu's "Select" enters
 *   selection mode with it; from then on a TAP picks or un-picks messages;
 * - a swipe to the right answers it (`onReply`), touch only.
 *
 * A picked row is tinted across the thread's width and the header turns into
 * the selection's action bar (MessageActionBar). A message still in the
 * outbox has no server copy to act on: `disabled` leaves it an ordinary row.
 * `highlighted` is the short flash after a tap on a quote of it.
 */
export function SelectableMessage({
  conversationId,
  messageId,
  disabled = false,
  canReply = false,
  highlighted = false,
  onPress,
  onReply,
  className,
  children,
}: {
  conversationId: string;
  messageId: string;
  disabled?: boolean;
  /** Not deleted and not pending - a swipe may answer it. */
  canReply?: boolean;
  highlighted?: boolean;
  /** A held press (touch) - the thread opens the emoji bar over the message. */
  onPress?: () => void;
  onReply?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("chat");
  const picked = useSelectionStore(
    (s) =>
      s.selected?.kind === "messages" &&
      s.selected.conversationId === conversationId &&
      s.selected.ids.includes(messageId),
  );
  const selectionActive = useMessageSelectionActive(conversationId);
  const selectMessage = useSelectionStore((s) => s.selectMessage);
  const toggleMessage = useSelectionStore((s) => s.toggleMessage);
  const toggle = () => {
    if (!toggleMessage(conversationId, messageId)) toast.error(t("selectionFull"));
  };
  const gesture = useSelectGesture(
    (source) => {
      if (selectionActive) return toggle();
      selectMessage(conversationId, messageId, source === "press");
      if (source === "press") onPress?.();
    },
    selectionActive ? toggle : null,
  );
  const swipe = useSwipeReply(() => onReply?.(), canReply && !!onReply && !selectionActive && !disabled);

  const handlers = disabled
    ? {}
    : {
        ...gesture,
        onPointerDown: (e: React.PointerEvent) => {
          gesture.onPointerDown(e);
          swipe.handlers.onPointerDown(e);
        },
        onPointerMove: (e: React.PointerEvent) => {
          gesture.onPointerMove(e);
          swipe.handlers.onPointerMove(e);
        },
        onPointerUp: () => {
          gesture.onPointerUp();
          swipe.handlers.onPointerUp();
        },
        onPointerCancel: () => {
          gesture.onPointerCancel();
          swipe.handlers.onPointerCancel();
        },
      };

  return (
    <div
      {...handlers}
      data-message-id={messageId}
      data-picked={picked || undefined}
      // data-keep-selection: in selection mode a click on a message is a
      // toggle, not "clicked elsewhere" (see MessageThread).
      data-keep-selection={selectionActive || undefined}
      className={cn(
        // The touch callout and text selection would fight the held press;
        // pan-y keeps the thread scrolling and hands sideways drags to the swipe.
        "relative -mx-2 rounded-lg px-2 py-0.5 transition-colors duration-500 [-webkit-touch-callout:none] pointer-coarse:select-none touch-pan-y",
        picked ? "bg-primary/15" : highlighted && "bg-primary/25",
        selectionActive && "cursor-pointer",
      )}
    >
      {swipe.offset > 0 && (
        <span
          aria-hidden
          className="absolute left-2 top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground"
          style={{ opacity: Math.min(1, swipe.offset / SWIPE_REPLY_PX) }}
        >
          <Reply className="size-4" />
        </span>
      )}
      <div
        className={cn(className, !swipe.swiping && "transition-transform duration-200")}
        style={swipe.offset ? { transform: `translateX(${swipe.offset}px)` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
