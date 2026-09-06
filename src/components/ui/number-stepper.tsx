"use client";

import { ChevronUp, ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Number input with custom stepper arrows. Chromium ignores `cursor` on the
 * native `::-webkit-*-spin-button`, so we hide it and render our own up/down
 * chevrons that actually show a pointer cursor and respect step/min/max.
 *
 * Controlled. `value` may be `null` (renders empty, for optional fields); set
 * `allowEmpty` so clearing the field reports `null` instead of `0`. When
 * `allowEmpty` and a value is present, a clear (×) button is shown so the field
 * can be returned to its empty/"optional" state - otherwise a `min` bound traps
 * the user at the lowest value with no way back to empty.
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
  "aria-invalid": ariaInvalid,
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
  /** Forwarded to the inner input so an invalid value gets the red border. */
  "aria-invalid"?: boolean | "true" | "false";
}) {
  const clamp = (n: number) => {
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    return v;
  };
  const stepBy = (dir: 1 | -1) => {
    // From empty, the first nudge lands on the floor (`min`, or 0), not floor +
    // step - otherwise an optional field with min=1 jumps straight to 2 on the
    // first up-click, which reads as a bug.
    if (value == null) {
      onChange(clamp(min ?? 0));
      return;
    }
    onChange(clamp(value + dir * step));
  };

  // Disable (and dim) the arrow that can't move the value any further.
  const current = value ?? min ?? 0;
  const atMax = max != null && current >= max;
  const atMin = min != null && current <= min;
  const showClear = allowEmpty && value != null;

  const arrowClass =
    "flex h-3.5 w-5 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        step={step}
        // Intentionally NOT forwarding native min/max: they trigger the browser's
        // own validation popup ("Value must be less than or equal to ...") on
        // submit, which we replace with inline messages + a disabled save. The
        // stepper arrows still clamp via the `min`/`max` props.
        placeholder={placeholder}
        value={value ?? ""}
        aria-invalid={ariaInvalid}
        // Typing into a field that already reads "0" otherwise prepends to it -
        // you aim for 65 and get 065, then have to go back and delete the zero.
        // Selecting on focus makes the first keystroke replace the value, which
        // is what every native spinner does.
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(allowEmpty ? null : 0);
            return;
          }
          const n = Number(raw);
          if (!Number.isNaN(n)) onChange(n);
        }}
        // Hide the native spinner (its cursor can't be styled). Extra right
        // padding when the clear button is showing so digits never slide under it.
        className={cn(
          "[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          showClear ? "pr-12" : "pr-7",
        )}
      />
      {showClear && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Clear"
          onClick={() => onChange(null)}
          className="absolute right-6 top-1/2 flex h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
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
