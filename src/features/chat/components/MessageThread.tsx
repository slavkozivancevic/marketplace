"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatMessage } from "../types";
import { UserProfile } from "../hooks/useUserProfiles";

interface Props {
  messages: ChatMessage[];
  currentUserId: string;
  isLoading: boolean;
  profiles?: Record<string, UserProfile>;
  onSend: (text: string) => void;
  onMarkRead: (messageIds: string[]) => void;
}

function getInitials(name: string | null | undefined, fallback: string): string {
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

export function MessageThread({
  messages,
  currentUserId,
  isLoading,
  profiles = {},
  onSend,
  onMarkRead,
}: Props) {
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef(new Set<string>());

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark unread messages as read
  useEffect(() => {
    const unread = messages
      .filter(
        (m) =>
          m.senderId !== currentUserId &&
          !(m.readBy ?? []).includes(currentUserId)
      )
      .map((m) => m.sk ?? `MSG#${m.createdAt}#${m.messageId}`)
      .filter((sk) => !markedRef.current.has(sk));

    if (unread.length > 0) {
      unread.forEach((sk) => markedRef.current.add(sk));
      onMarkRead(unread);
    }
  }, [messages, currentUserId, onMarkRead]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={cn("flex gap-2", i % 2 === 0 ? "" : "flex-row-reverse")}>
            <Skeleton className="size-7 rounded-full shrink-0" />
            <Skeleton className={cn("h-10 rounded-2xl", i % 2 === 0 ? "w-48" : "w-36")} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            No messages yet. Say hello!
          </div>
        )}

        {[...messages].reverse().map((msg) => {
          const isMine = msg.senderId === currentUserId;
          const readBy = msg.readBy ?? [];
          const senderProfile = profiles[msg.senderId];
          const senderInitials = getInitials(senderProfile?.name, msg.senderId);

          return (
            <div
              key={msg.messageId}
              className={cn("flex gap-2 items-end", isMine && "flex-row-reverse")}
            >
              {/* Avatar — only for received messages */}
              {!isMine && (
                <>
                  {senderProfile?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={senderProfile.imageUrl}
                      alt={senderProfile.name ?? ""}
                      className="size-7 rounded-full shrink-0 object-cover mb-0.5"
                    />
                  ) : (
                    <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">
                      {senderInitials}
                    </div>
                  )}
                </>
              )}

              <div className={cn("flex flex-col gap-1 max-w-[75%]", isMine && "items-end")}>
                <div
                  className={cn(
                    "px-3 py-2 rounded-2xl text-sm leading-snug",
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}
                >
                  {msg.text}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(msg.createdAt), "HH:mm")}
                  </span>
                  {isMine && (
                    readBy.length > 1 ? (
                      <span className="inline-flex items-center text-[10px] text-muted-foreground">
                        <span>✓</span>
                        <span className="-ml-0.75">✓</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">✓</span>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t p-3 flex items-end gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          className="min-h-9 max-h-32 resize-none text-sm"
          rows={1}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!text.trim()}
          className="shrink-0"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}