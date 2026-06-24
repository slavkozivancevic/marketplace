"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateLocale } from "@/lib/i18n/dateLocale";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Local YYYY-MM-DD (no UTC shift, unlike toISOString). */
function toYMD(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function parseYMD(v: string | null): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Themed, locale-aware date picker (no react-day-picker dependency). Value is a
 * YYYY-MM-DD string; week starts Monday. The Popover handles open state so there
 * is no native double-open glitch, and the icon trigger is a proper button.
 */
export function DatePicker({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const locale = useLocale();
  const dl = dateLocale(locale);
  const selected = parseYMD(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => selected ?? new Date());

  const monthLabel = new Intl.DateTimeFormat(dl, { month: "long", year: "numeric" }).format(view);
  const triggerLabel = selected
    ? new Intl.DateTimeFormat(dl, { day: "numeric", month: "long", year: "numeric" }).format(selected)
    : placeholder ?? "";

  // Monday-first weekday short names.
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i); // 2024-01-01 is a Monday
    return new Intl.DateTimeFormat(dl, { weekday: "short" }).format(d);
  });

  // Day grid for the viewed month, padded so the 1st lands under its weekday.
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7; // shift Sun=0 to Monday-first
  const cells: (Date | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)),
  ];
  const today = new Date();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm transition-colors hover:bg-accent/40 dark:bg-input/30",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
          <span className="flex-1 text-left truncate">{triggerLabel}</span>
          {selected && (
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center justify-between pb-2">
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
            onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium capitalize">{monthLabel}</span>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
            onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {weekdays.map((w, i) => (
            <div key={i} className="text-[11px] text-muted-foreground py-1 capitalize">{w}</div>
          ))}
          {cells.map((d, i) =>
            d ? (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onChange(toYMD(d));
                  setOpen(false);
                }}
                className={cn(
                  "h-8 w-8 rounded-md text-sm transition-colors cursor-pointer hover:bg-accent",
                  selected && sameDay(d, selected)
                    ? "bg-primary text-primary-foreground hover:bg-primary"
                    : sameDay(d, today)
                      ? "border border-input"
                      : "",
                )}
              >
                {d.getDate()}
              </button>
            ) : (
              <div key={i} />
            ),
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
