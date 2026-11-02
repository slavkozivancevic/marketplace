"use client";

import { useTranslations } from "next-intl";
import { Ban, FileText, ImageIcon, Loader2, Paperclip, Play, Video, X } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { RetryImage } from "@/components/RetryImage";
import { cn } from "@/lib/utils";
import { useAttachmentReadUrl } from "../hooks/useAttachmentReadUrl";
import type { ReplyQuote } from "../types";

type Kind = "image" | "video" | "pdf" | "file";

function kindOf(type: string): Kind {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type === "application/pdf") return "pdf";
  return "file";
}

const KIND_ICON = { image: ImageIcon, video: Video, pdf: FileText, file: Paperclip } as const;

/** The small picture on the right of a quote of a photo or a video, as on WhatsApp. */
function QuoteThumb({ attachmentKey, kind }: { attachmentKey: string; kind: Kind }) {
  const { data: url } = useAttachmentReadUrl(attachmentKey, kind === "image");
  return (
    <span className="relative size-10 shrink-0 overflow-hidden rounded bg-muted">
      {kind === "image" && url ? (
        <RetryImage src={url} alt="" fill unoptimized sizes="40px" className="object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          {kind === "video" ? <Play className="size-4" /> : <ImageIcon className="size-4" />}
        </span>
      )}
    </span>
  );
}

/**
 * A quote of the message a reply answers, as on WhatsApp: a coloured line,
 * who wrote it ("You" for the viewer), and what it said - the excerpt, or an
 * icon and a label for a file, with a thumbnail for a photo or a video. A
 * quote of a message deleted for everyone shows the placeholder and nothing
 * of what it said.
 *
 * Two places: inside the reply's bubble (`onJump` scrolls to the original),
 * and above the composer while a reply is being written (`onCancel` drops it).
 */
export function QuoteBlock({
  quote,
  currentUserId,
  senderName,
  onBubble = "theirs",
  onJump,
  jumping = false,
  onCancel,
  className,
}: {
  quote: ReplyQuote;
  currentUserId: string;
  /** The original sender's display name, when it is not the viewer. */
  senderName: string;
  /** The bubble the quote sits in - own bubbles are the primary colour. */
  onBubble?: "mine" | "theirs" | "composer";
  onJump?: () => void;
  /** The original is being loaded to jump to it. */
  jumping?: boolean;
  onCancel?: () => void;
  className?: string;
}) {
  const t = useTranslations("chat");
  const fromMe = quote.senderId === currentUserId;
  const kind = quote.attachment ? kindOf(quote.attachment.type) : null;
  const Icon = kind ? KIND_ICON[kind] : null;
  const label =
    kind === "image" ? t("photo")
      : kind === "video" ? t("video")
      : quote.attachment?.filename ?? t("file");

  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-xs font-semibold", onBubble === "mine" ? "text-primary-foreground" : "text-primary")}>
          {fromMe ? t("you") : senderName}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 text-xs",
            onBubble === "mine" ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {quote.deleted ? (
            <>
              <Ban className="size-3 shrink-0" />
              <span className="truncate italic">{fromMe ? t("youDeletedThisMessage") : t("thisMessageWasDeleted")}</span>
            </>
          ) : (
            <>
              {Icon && <Icon className="size-3 shrink-0" />}
              <span className="line-clamp-2 wrap-break-word">{quote.excerpt || label}</span>
            </>
          )}
        </span>
      </span>
      {jumping && <Loader2 className="size-3.5 shrink-0 animate-spin" />}
      {!quote.deleted && quote.attachment && (kind === "image" || kind === "video") && (
        <QuoteThumb attachmentKey={quote.attachment.key} kind={kind} />
      )}
    </>
  );

  const frame = cn(
    "flex items-center gap-2 rounded-md border-l-4 py-1 pl-2 pr-1 text-left",
    onBubble === "mine" ? "border-primary-foreground/70 bg-primary-foreground/10" : "border-primary bg-background/60",
    onBubble === "composer" && "bg-muted/50",
    className,
  );

  if (onCancel) {
    return (
      <div className={frame}>
        {body}
        <IconButton label={t("cancelReply")} variant="ghost" size="icon-sm" onClick={onCancel}>
          <X className="size-4" />
        </IconButton>
      </div>
    );
  }
  return (
    <button
      type="button"
      // In selection mode the row's capture turns this tap into a toggle
      // first, as for the rest of the bubble.
      onClick={(e) => {
        e.stopPropagation();
        onJump?.();
      }}
      className={cn(frame, "w-full cursor-pointer")}
    >
      {body}
    </button>
  );
}
