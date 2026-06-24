"use client";

import { ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Number input with custom stepper arrows. Chromium ignores `cursor` on the
 * native `::-webkit-*-spin-button`, so we hide it and render our own up/down
 * chevrons that actually show a pointer cursor and respect step/min/max.
 *
 * Controlled. `value` may be `null` (renders empty, for optional fields); set
 * `allowEmpty` so clearing the field reports `null` instead of `0`.
 */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min,
  max,
  id,
  placeholder,
  allowEmpty = false,
  className,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  id?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  className?: string;
}) {
  const clamp = (n: number) => {
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    return v;
  };
  const stepBy = (dir: 1 | -1) => onChange(clamp((value ?? min ?? 0) + dir * step));

  // Disable (and dim) the arrow that can't move the value any further.
  const current = value ?? min ?? 0;
  const atMax = max != null && current >= max;
  const atMin = min != null && current <= min;

  const arrowClass =
    "flex h-3.5 w-5 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(allowEmpty ? null : 0);
            return;
          }
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(n);
        }}
        // Hide the native spinner (its cursor can't be styled).
        className="pr-7 [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Increment"
          disabled={atMax}
          onClick={() => stepBy(1)}
          className={arrowClass}
        >
          <ChevronUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Decrement"
          disabled={atMin}
          onClick={() => stepBy(-1)}
          className={arrowClass}
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
