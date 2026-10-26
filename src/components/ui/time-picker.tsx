"use client";

import { useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));

function parseHM(v: string | null | undefined): [string, string] | null {
  const m = /^(\d{2}):(\d{2})$/.exec(v ?? "");
  return m ? [m[1], m[2]] : null;
}

/**
 * Themed 24-hour time picker, the counterpart of DatePicker. Value is "HH:mm".
 * Replaces `<input type="time">`, whose popup the browser draws in its own
 * colours (no CSS reaches it) and whose AM/PM follows the OS, not the page.
 * The popover stays open while a time is being put together: picking the hour
 * keeps the minutes, picking the minute closes it.
 */
export function TimePicker({
  id,
  value,
  onChange,
  invalid,
  className,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
  invalid?: boolean;
  className?: string;
}) {
  const parsed = parseHM(value);
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const pick = (hour: string, minute: string, close: boolean) => {
    onChange(`${hour}:${minute}`);
    if (close) setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          // A button cannot carry aria-invalid; the field's error text says it.
          data-invalid={invalid || undefined}
          className={cn(
            "flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm tabular-nums transition-colors hover:bg-accent/40 dark:bg-input/30 data-invalid:border-destructive",
            !parsed && "text-muted-foreground",
            className,
          )}
        >
          <Clock className="size-4 text-muted-foreground shrink-0" />
          <span className="flex-1 text-left">{parsed ? `${parsed[0]}:${parsed[1]}` : "--:--"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        className="w-auto p-2"
        align="start"
        // Bring the current hour and minute into view, not 00 at the top.
        onOpenAutoFocus={() => {
          requestAnimationFrame(() => {
            contentRef.current
              ?.querySelectorAll<HTMLElement>("[data-selected]")
              .forEach((el) => el.scrollIntoView({ block: "center" }));
          });
        }}
      >
        <div className="flex gap-1">
          <TimeColumn
            items={HOURS}
            selected={parsed?.[0]}
            onPick={(h) => pick(h, parsed?.[1] ?? "00", false)}
          />
          <TimeColumn
            items={MINUTES}
            selected={parsed?.[1]}
            onPick={(m) => pick(parsed?.[0] ?? "00", m, true)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TimeColumn({
  items,
  selected,
  onPick,
}: {
  items: string[];
  selected: string | undefined;
  onPick: (v: string) => void;
}) {
  return (
    <ScrollArea className="h-56 w-14">
      <div className="flex flex-col gap-0.5 p-0.5">
        {items.map((v) => (
          <button
            key={v}
            type="button"
            data-selected={v === selected ? "" : undefined}
            onClick={() => onPick(v)}
            className={cn(
              "h-8 w-full shrink-0 rounded-md text-sm tabular-nums transition-colors cursor-pointer hover:bg-accent",
              v === selected && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}
