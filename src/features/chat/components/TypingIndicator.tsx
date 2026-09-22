"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { UserProfile } from "../hooks/useUserProfiles";

/**
 * The three animating dots. `aria-hidden` on purpose - the surrounding row
 * carries one polite announcement; letting a screen reader chase the animation
 * would repeat it forever.
 */
function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-1", className)} aria-hidden="true">
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className="chat-typing-dot size-1.5 rounded-full bg-current"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

function initials(name: string | null | undefined, fallback: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return fallback.slice(0, 2).toUpperCase();
}

interface BubbleProps {
  userId: string;
  profile?: UserProfile;
}

/**
 * The in-thread indicator: an incoming message bubble with dots instead of
 * text, so it reads as the message that is about to arrive.
 *
 * Two things about this row are load-bearing for the scroll container it lives
 * in (see MessageThread):
 *
 *  - It is mounted only while someone is typing, and it is at its FINAL height
 *    from the first painted frame. The entrance animates `opacity` and
 *    `transform` only - never height or margin - so the container's
 *    scrollHeight changes exactly once, in the commit React performs, which is
 *    the commit the layout effect re-pins against. An animated height would
 *    keep growing for the length of the transition and drift out from under it.
 *  - `overflow-anchor: none` keeps Chrome's scroll anchoring from picking this
 *    ephemeral node as its anchor and nudging scrollTop behind our back when
 *    it unmounts.
 */
export function TypingBubble({ userId, profile }: BubbleProps) {
  const t = useTranslations("chat");
  const name = profile?.name ?? "";

  return (
    <div
      className="flex gap-2 items-end [overflow-anchor:none] chat-typing-enter"
      aria-live="polite"
      aria-atomic="true"
    >
      {profile?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.imageUrl}
          alt=""
          className="size-7 rounded-full shrink-0 object-cover mb-0.5"
        />
      ) : (
        <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">
          {initials(name, userId)}
        </div>
      )}

      <div className="px-3.5 py-3 rounded-2xl rounded-bl-sm bg-muted text-muted-foreground">
        <TypingDots />
      </div>

      <span className="sr-only">
        {name ? t("isTyping", { name }) : t("typing")}
      </span>
    </div>
  );
}

/**
 * The inbox variant: replaces the last-message preview on a conversation row.
 * Same line height as the preview it stands in for, so the list never reflows
 * when someone starts or stops typing.
 */
export function TypingPreview() {
  const t = useTranslations("chat");
  return (
    <p className="text-xs text-primary font-medium truncate mt-0.5 flex items-center gap-1.5">
      <TypingDots />
      <span className="truncate">{t("typing")}</span>
    </p>
  );
}
